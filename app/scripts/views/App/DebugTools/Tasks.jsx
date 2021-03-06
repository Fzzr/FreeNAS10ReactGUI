// Tasks Tab
// =========

"use strict";

import _ from "lodash";
import React from "react";
import { Alert, Button, Col, Input, ProgressBar, Row } from "react-bootstrap";
import moment from "moment";

// freeNASUtil
import freeNASUtil
  from "../../../utility/freeNASUtil";

// Middleware
import MiddlewareClient from "../../../websocket/MiddlewareClient";
import TasksStore from "../../../flux/stores/TasksStore";
import TasksMiddleware from "../../../flux/middleware/TasksMiddleware";


var TasksSection = React.createClass(

  { displayName: "Debug Tools - Tasks Tab"

  , propTypes: { tasks        : React.PropTypes.object.isRequired
               , showProgress : React.PropTypes.bool
               , canCancel    : React.PropTypes.bool
    }

  , createTask: function ( taskID, index ) {
      let taskData  = this.props.tasks[ taskID ];
      let taskName  = null;
      let progress  = null;
      let cancelBtn = null;
      let started   = taskData["started_at"] ? moment.unix( taskData["started_at"] ).format( "YYYY-MM-DD HH:mm:ss" ) : "--";
      let finished  = taskData["finished_at"] ? moment.unix( taskData["finished_at"] ).format( "YYYY-MM-DD HH:mm:ss" ) : "--";
      let abortable = false;
      let message   = "";

      if ( typeof this.props.canCancel === "undefined" &&
           taskData["abortable"] ) {
        abortable = true;
      }

      if ( _.has( taskData, "name" ) ) {
        taskName = <h5 className="debug-task-title">{ taskData["name"] }</h5>;
      }

      if ( this.props.showProgress ) {
        let progressprops     = {};
        progressprops.now     = taskData["percentage"];
        progressprops.bsStyle = "info";
        progressprops.label   = "%(percent)s%";
        switch ( taskData["state"] ) {
          case "WAITING":
            progressprops.active  = true;
            progressprops.now     = 100;
            progressprops.label   = "Waiting...";
            break;
          case "FINISHED":
            progressprops.bsStyle = "success";
            progressprops.label   = "Completed";
            break;
          case "FAILED":
            progressprops.bsStyle = "danger";
            progressprops.label   = "Failed";
            break;
          case "ABORTED":
            progressprops.bsStyle = "warning";
            progressprops.label   = "Aborted";
            break;
        }
        progress = <ProgressBar {...progressprops} />;
      }

      this.callAbort = function () {
        TasksMiddleware.abortTask( taskID );
      };

      if ( this.props.canCancel || abortable ) {
        cancelBtn = <Button
                      bsSize    = "small"
                      className = "debug-task-abort"
                      bsStyle   = "danger"
                      onClick   = { this.callAbort }>Abort Task</Button>;
      }

      if ( taskData["message"] ) {
        message = "Message: " + taskData["message"];
      }

      return (
        <div
          className = "debug-task-item"
          key       = { index }>
          <div className="debug-task-id">{ taskID }</div>
          <div className="debug-task-details">
            { taskName } { message }
            <div className="clearfix">
              <h6 className="debug-task-timestamp">
                {"Task Started: " + started }</h6>
              <h6 className="debug-task-timestamp">
                {"Task Finished: " + finished }</h6>
            </div>
            <hr />
            <div className = "clearfix">
              { cancelBtn }
              { progress }
            </div>
          </div>
        </div>
      );
    }
  , render: function () {
      var taskIDs = _.sortBy( _.keys( this.props.tasks ), [ "id" ] ).reverse();
      return (
        <div className="debug-column-content">
          { taskIDs.map( this.createTask ) }
        </div>
      );
    }

});

var Tasks = React.createClass(
  { getInitialState: function () {
      return { tasks           : _.assign( {}, TasksStore.tasks )
             , taskMethodValue : ""
             , argsValue       : "[[]]"
             , anErrorOccurred : false
             , taskTraceback   : ""
      };
    }

  , init: function ( tasks ) {
      var histFinished    = {};
      var histFailed      = {};
      var histAborted     = {};

      tasks.forEach( function ( task ) {
        switch ( task["state"] ) {
          case "FINISHED":
            histFinished[ task["id"] ] = task;
            histFinished[ task["id"] ]["percentage"] = 100;
            break;
          case "FAILED":
            histFailed[ task["id"] ] = task;
            histFailed[ task["id"] ]["percentage"] = task["percentage"] ?
                                                       task["percentage"] : 50;
            break;
          case "ABORTED":
            histAborted[ task["id"] ] = task;
            histAborted[ task["id"] ]["percentage"] = task["percentage"] ?
                                                        task["percentage"] : 50;
            break;
        }
      });

      this.setState({ tasks : _.merge( {}, { FINISHED: histFinished }
                    , { FAILED: histFailed }
                    , { ABORTED: histAborted }, TasksStore.tasks )
      });
    }

  , componentDidMount: function () {
      TasksMiddleware.subscribe( this.constructor.displayName );
      TasksStore.addChangeListener( this.handleMiddlewareChange );

      TasksMiddleware.getCompletedTaskHistory( this.init );
    }

  , componentWillUnmount: function () {
      TasksStore.removeChangeListener( this.handleMiddlewareChange );
      TasksMiddleware.unsubscribe( this.constructor.displayName );
    }

  , handleMiddlewareChange: function ( eventType ) {
      this.setState(
        { tasks : _.merge( {}
        , { FINISHED: this.state.tasks["FINISHED"] }
        , { FAILED: this.state.tasks["FAILED"] }
        , { ABORTED: this.state.tasks["ABORTED"] }
        , TasksStore.tasks )
        }
      );
    }

  , handleMethodInputChange: function ( event ) {
      this.setState(
        { taskMethodValue: event.target.value }
      );
    }

  , handleArgsInputChange: function ( event ) {
      this.setState(
        { argsValue: event.target.value }
      );
    }

  , handleTaskErrorCallback: function ( args ) {
      this.setState(
        { anErrorOccurred : true
        , taskTraceback   : args
        }
      )
    }

  , handleAlertDismiss: function () {
      this.setState(
        { anErrorOccurred: false })
    }

  , handleTaskSubmit: function () {
      try {
        var taskAgg = [ String( this.state.taskMethodValue ) ].concat(
          JSON.parse( this.state.argsValue ) );
        MiddlewareClient.request( "task.submit"
                                , taskAgg
                                , null
                                , this.handleTaskErrorCallback );
      }
      catch ( err ) {
        this.handleTaskErrorCallback( freeNASUtil.getStackTrace( err ) );
      }
    }

  , render: function () {
      let taskAlert = "";
      if ( this.state.anErrorOccurred ) {
        let errStack = ( <p> </p> );
        if ( this.state.taskTraceback.constructor === Array ) {
          errStack = this.state.taskTraceback.map(
            function ( errval, index ) {
              return ( <p key = { index }>{  errval }</p> )
            }
          );
        } else {
          errStack = ( <p>{this.state.taskTraceback}</p> );
        }
        taskAlert = (
          <div className="overlay-error">
            <Alert bsStyle='danger' onDismiss={this.handleAlertDismiss}>
              <h4>Oh snap! A very specific Error Occurred</h4>
              {errStack}
              <p>
                <Button onClick={this.handleAlertDismiss}>
                 Done
                </Button>
              </p>
             </Alert>
           </div> )
      }
      return (
        <div className="debug-content-flex-wrapper">
          {taskAlert}

          <Col xs={6} className="debug-column" >

            <h5 className="debug-heading">Schedule Task</h5>
            <Row>
              <Col xs={5}>
                <Input type        = "text"
                            placeholder = "Task Name"
                            onChange    = { this.handleMethodInputChange }
                            value       = { this.state.taskMethodValue } />
              </Col>
            </Row>
            <Row>
              <Col xs={5}>
                <Input type        = "textarea"
                            style       = {{ resize: "vertical"
                                           , height: "100px" }}
                            placeholder = "Arguments (JSON Array)"
                            onChange    = { this.handleArgsInputChange }
                            value       = { this.state.argsValue } />
              </Col>
            </Row>
            <Row>
              <Col xs={5}>
                <Button bsStyle = "primary"
                             onClick = { this.handleTaskSubmit }
                             block>
                  {"Submit"}
                </Button>
              </Col>
            </Row>

          </Col>

          <Col xs={6} className="debug-column" >
            <h5 className="debug-heading">
              {  "Created Tasks ("
                 + _.keys( this.state.tasks["CREATED"] ).length
                 + ")" }
            </h5>
            <TasksSection
              tasks = { this.state.tasks["CREATED"] } canCancel />

            <h5 className="debug-heading">
              {  "Waiting Tasks ("
                 + _.keys( this.state.tasks["WAITING"] ).length
                 + ")" }
            </h5>
            <TasksSection
              tasks = { this.state.tasks["WAITING"] } showProgress canCancel />

            <h5 className="debug-heading">
              {  "Executing Tasks ("
                 + _.keys( this.state.tasks["EXECUTING"] ).length
                 + ")" }
            </h5>
            <TasksSection
              tasks = { this.state.tasks["EXECUTING"] } showProgress />
          </Col>

          <Col xs={6} className="debug-column" >
            <h5 className="debug-heading">{  "Finished Task History" }</h5>
            <TasksSection tasks = { this.state.tasks["FINISHED"] }
                          showProgress canCancel = {false} />
            <h5 className="debug-heading">{  "Failed Task History" }</h5>
            <TasksSection
              tasks = { this.state.tasks["FAILED"] }
                      showProgress canCancel = {false} />
            <h5 className="debug-heading">{  "Aborted Task History" }</h5>
            <TasksSection
              tasks = { this.state.tasks["ABORTED"] }
                      showProgress canCancel = {false} />
          </Col>

        </div>
      );
    }

});

module.exports = Tasks;
