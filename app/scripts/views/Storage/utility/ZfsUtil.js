// ZFS UTIL
// ========
// Utility class containing helper methods for various different ZFS concerns.
// Prefer adding methods to this class over marooning them in various different
// React components.

"use strict";

import _ from "lodash";

import { VDEV_TYPES, DISK_CHUNKS } from "./ZfsConstants";

class ZfsUtil {

  static getMemberDiskPaths( collection ) {
    let paths = [];

    if ( collection ) {
      if ( collection.type === "disk" ) {
        paths.push( collection.path );
      } else {
        paths = _.pluck( collection.children, "path" );
      }
    }

    return paths;
  }

  static getSmallestDisk ( paths, disks ) {
    let smallest = null;

    if ( !Array.isArray( paths ) ) {
      console.warn( "The first argument to getSmallestDisk must be an array of "
                  + "disk paths"
                  );
      return;
    }

    if ( !disks || typeof disks !== "object" ) {
      console.warn( "The second argument to getSmallestDisk must be an object "
                  + "keyed by disk path"
                  );
      return;
    } else if ( Object.keys( disks ).length === 0 ) {
      console.warn( "Disks object must not be empty" );
      return;
    }

    paths.forEach( path => {
      if ( disks[ path ] && disks[ path ].mediasize ) {
        if ( smallest ) {
          if ( disks[ path ].mediasize < smallest.mediasize ) {
            smallest = disks[ path ];
          }
        } else {
          smallest = disks[ path ];
        }
      } else {
        console.warn( `Could not read mediasize of ${ path }`, disks[ path ] );
        return;
      }
    });

    return smallest;
  }

  static calculateBreakdown ( collection, disks ) {
    let breakdown =
      { parity : 0
      , avail  : 0
      };

    collection.forEach( vdev => {
      if ( vdev.type ) {
        let smallestDisk =
          ZfsUtil.getSmallestDisk( ZfsUtil.getMemberDiskPaths( vdev ), disks );

        let baseSize = _.has( smallestDisk, "mediasize" )
                     ? smallestDisk.mediasize
                     : 0;
        let parity;
        let avail;

        switch ( vdev.type ) {
          case "disk":
            parity = 0;
            avail  = baseSize;
            break;

          case "stripe":
            parity = 0;
            avail  = baseSize * vdev.children.length;
            break;

          case "mirror":
            parity = baseSize * ( vdev.children.length - 1 );
            avail  = baseSize;
            break;

          case "raidz1":
            parity = baseSize * 1;
            avail  = ( baseSize * vdev.children.length ) - parity;
            break;

          case "raidz2":
            parity = baseSize * 2;
            avail  = ( baseSize * vdev.children.length ) - parity;
            break;

          case "raidz3":
            parity = baseSize * 3;
            avail  = ( baseSize * vdev.children.length ) - parity;
            break;
        }

        breakdown.parity += parity;
        breakdown.avail  += avail;
      }
    });

    return breakdown;
  }

  static calculatePreferences ( safety, speed, storage ) {
    //                    1         2/3        1/3         0
    //            Safety  |--raidz2--|--raidz1--|--Mirror--|
    //            Speed   |--Mirror--|--raidz1--|--raidz2--|
    //            Storage |--raidz1--|--raidz2--|--Mirror--|
    //
    // A visual representation of the mapping used to calculate topology
    // preferences. It is, essentially, a weighted voting system where a value
    // within the bounds of a given range will count as a vote for that layout
    // multiplied by the scalar. This gives an even distribution to the total
    // area of each topology in terms of area, but biases based on the
    // provided Barycentric Coordinates.

    const layouts = [ [ "raidz2", "raidz1", "mirror" ]
                    , [ "mirror", "raidz1", "raidz1" ]
                    , [ "raidz1", "raidz1", "raidz1" ]
                    ];

    let preferences = { highest: 0
                      , priority: null
                      , desired: null
                      };
    let votes = { mirror: 0
                , raidz1: 0
                , raidz2: 0
                };

    function addVotes ( scalar, index ) {
      let victor;

      if ( scalar < 0.33 ) {
        victor = layouts[ index ][2];
      } else if ( scalar < 0.66 ) {
        victor = layouts[ index ][1];
      } else {
        victor = layouts[ index ][0];
      }

      if ( scalar > preferences.highest ) {
        preferences.highest = scalar;
        preferences.priority = [ "safety", "speed", "storage" ][ index ];
      }

      votes[ victor ] += scalar;
    }

    [ safety, speed, storage ].forEach( addVotes );

    preferences.desired = Object.keys( votes )
                                .sort( ( a, b ) => votes[b] - votes[a] );

    return preferences;
  }

  static createNewDisk ( path ) {
    return ( { path: path
             , type: "disk"
             , children: []
             }
    );
  }

  static getAllowedVdevTypes ( disks, purpose ) {
    let allowedTypes = [];

    if ( disks.length === 1 ) {
      allowedTypes.push( VDEV_TYPES[ purpose ][0] );
    } else if ( disks.length > 1 ) {
      // This might look "too clever" at first, but it's very simple. The
      // VDEV_TYPES array contains 5 entries, from "disks" to "raidz3". To
      // have three parity drives for a VDEV, you need to have two data disks.
      // If you only have one, then what you actually have is a four-way
      // mirror. This holds true for Z2 and Z1, all the way down to the case
      // where you have two disks, and your only option is to mirror or stripe
      // them (but striping is bad and we might want to not allow it in
      // certain "purposes", like data ). We add one to the length of the
      // array to accommodate both "stripe" and "mirror".
      if ( VDEV_TYPES[ purpose ].length > 1 ) {
        allowedTypes.push(
          ...VDEV_TYPES[ purpose ].slice( 1, disks.length + 1 )
        );
      } else {
        allowedTypes.push( VDEV_TYPES[ purpose ][0] );
      }
    }

    return allowedTypes;
  }

  static requestVdevTypeChange ( type, purpose, allowedTypes ) {
    let newType = null;

    if ( type ) {
      let typeIndex = VDEV_TYPES[ purpose ].indexOf( type );
      let allowedIndex = allowedTypes.indexOf( type );

      if ( typeIndex > ( allowedTypes.length - 1 ) ) {
        // The user has selected a type, but the number of disks available
        // now no longer supports that option. We should, then, select the
        // *next* highest possible option: Z2 to Z1, Z1 to mirror, etc.
        newType = _.last( allowedTypes );
      } else if ( allowedIndex > -1 ) {
        // The user has indicated a desire for this VDEV to be a certain
        // type, and we have found that type in the array of allowed values.
        // This is the simplest outcome: The user retains their selection.
        newType = type;
      }
    }

    return newType;
  }

  static reconstructVdev ( key, purpose, purposeVdevs, disks = [], currentType = null ) {
    let newVdev;
    let newType;
    let vdevAllowedTypes = this.getAllowedVdevTypes( disks, purpose );

    if ( disks.length === 1 ) {
      newVdev = this.createNewDisk( disks[0] );
    } else if ( disks.length > 1 ) {
      newType = this.requestVdevTypeChange( currentType, purpose, vdevAllowedTypes );

      if ( !newType ) {
        // The only case in which a user could have a lower selection index
        // is when transitioning from "disk" to something else, or else the
        // user has not selected a type. We can select the first available
        // option in this case. This will have the effect of selecting the
        // first available type for two disks, usually "stripe".
        newType = vdevAllowedTypes[0];
      }

      newVdev =
        { path     : ""
        , type     : newType
        , children : _.sortBy( disks ).map( this.createNewDisk )
        };
    }

    if ( newVdev ) {
      // One of the above conditions resulted in the creation of a VDEV,
      // potentially including the "empty" VDEV that lives at the end of each
      // bucket.
      purposeVdevs[ key ] = newVdev;
    } else {
      // The alternate outcome is that we have an empty VDEV somewhere in the
      // middle of the bucket - probably because the user removed its disks
      purposeVdevs.splice( key, 1 );
    }

    // These values should be used by this.setState in a React component
    return (
      { [ purpose ]: purposeVdevs
      }
    );
  }

  static createTopology ( ssds, disks, preferences ) {
    let topology =
      { data  : []
      , log   : []
      , cache : []
      , spare : []
      };

    let allSelectedDisks = [];

    let desired = preferences.desired[0].toLowerCase();
    let chunkSize = DISK_CHUNKS[ desired ][ preferences.priority.toLowerCase() ];
    let chunks;

    let dataDisks;
    let ssdSplit;
    let logSSDs;
    let cacheSSDs;

    if ( ssds.length > disks.length ) {
      // In the event that more SSDs are available than HDDs, we will attempt to
      // create an all-flash pool with no log or cache devices, and ignoring any
      // spinning disks which may be present.
      dataDisks = ssds;
    } else {
      dataDisks = _.difference( disks, ssds );
      ssdSplit = Math.floor( ssds.length / 2 );
      logSSDs = ssds.slice( 0, ssdSplit );
      cacheSSDs = ssds.slice( ssdSplit, ssds.length );

      topology.log =
        this.reconstructVdev( 0
                            , "log"
                            , []
                            , logSSDs
                            , "stripe"
                            )["log"];
      allSelectedDisks = allSelectedDisks.concat( logSSDs );
      topology.cache =
        this.reconstructVdev( 0
                            , "cache"
                            , []
                            , cacheSSDs
                            , "stripe"
                            )["cache"];
      allSelectedDisks = allSelectedDisks.concat( cacheSSDs );
    }

    // Break the selected data disks into equally-sized chunks, if possible. We
    // will try to use these to create an even VDEV topology.
    chunks = _.chunk( dataDisks, chunkSize );

    if ( chunks.length && _.last( chunks ).length === chunkSize ) {
      // If the last chunk is the right size, all chunks are of even size and we
      // have no edge cases. The VDEVs are created according to the sizes of the
      // chunks, with one for each chunk.
    } else if ( chunks.length === 2 ) {
      // This is a shortcut case, and until someone has a better idea, we'll
      // just lump everything in a single VDEV so that there's no remainder.
      chunks[0] = chunks[0].concat( chunks.pop() );
      chunkSize = chunks[0].length;
    } else if ( chunks.length > 0 ) {
      // This is the annoying case, where there's some odd-numbered remainder in
      // the last chunk. This case totally blows, and there's really no good
      // outcome. The best we can do is evenly distribute the disks as best we
      // can, and hope that it still makes sense with the selected topology.
      let averagedRemainder =
        Math.floor( ( chunks.length - 1 ) / _.last( chunks ).length );

      if ( averagedRemainder > 0 ) {
        for ( let i = 0; i < chunks.length - 1; i++ ) {
          chunks[i].concat( _.last( chunks ).splice( 0, averagedRemainder ) );
        }
      }
      chunkSize = chunks[0].length;
    }

    chunks.forEach( ( chunkDisks, index ) => {
      if ( chunkDisks.length === chunkSize ) {
        topology.data =
          this.reconstructVdev( index
                              , "data"
                              , topology.data
                              , chunkDisks
                              , desired
                              )["data"];
        allSelectedDisks = allSelectedDisks.concat( chunkDisks );
      }
    });

    return [ topology, allSelectedDisks ];
  }

  static wrapStripe () {
    // TODO
  }

  static unwrapStripe ( vdevs ) {
    // Because "stripe" is not an officialy recognized ZFS property, we
    // approximate it in the FreeNAS GUI. What must actually be sent to ZFS
    // is a flattened array of "disk" VDEVs at the top level, which will
    // automatically be striped together.

    if ( _.isArray( vdevs ) ) {
      let unwrapped = [];

      vdevs.forEach( vdev => {
        if ( vdev.type === "stripe" ) {
          unwrapped.push( ...vdev.children );
        } else {
          unwrapped.push( vdev );
        }
      });

      return unwrapped;
    } else {
      return null;
    }
  }

}

export default ZfsUtil;
