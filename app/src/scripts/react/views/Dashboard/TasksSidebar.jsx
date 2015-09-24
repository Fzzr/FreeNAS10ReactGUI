// Tasks Context Sidebar
// =====================
// Display consolidated task history and progress.

"use strict";

import React from "react";
import _ from "lodash";

import EM from "../../../flux/middleware/EventsMiddleware";
import ES from "../../../flux/stores/EventsStore";

import TM from "../../../flux/middleware/TasksMiddleware";
import TS from "../../../flux/stores/TasksStore";


export default class TasksSidebar extends React.Component {
  constructor ( props ) {
    super( props );
    this.displayName = "TasksSidebar";
    this.state =
      { tasks: []
      , events: []
    };
  }

  componentDidMount () {
    ES.addChangeListener( this.handleChanges.bind( this ) );
    EM.requestEvents();

    TM.subscribe( this.displayName );
    TS.addChangeListener( this.handleChanges.bind( this ) );

    TM.requestAllTasks();
  }

  componentWillUnmount() {
    ES.removeChangeListener( this.handleChanges.bind( this ) );

    TM.unsubscribe( this.displayName );
    TS.removeChangeListener( this.handleChanges.bind( this ) );
  }

  handleChanges ( eventType ) {
    switch ( eventType ) {
      case "allTasks":
        this.setState( { tasks: TS.tasks } );
        break;
      case "events":
        this.setState( { events: ES.events } );
        break;
    }
  }

  render () { return null };

}
