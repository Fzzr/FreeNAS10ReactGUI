// Dashboard
// =========
// Default view for FreeNAS, shows overview of system and other general
// information.

"use strict";

import React from "react";

import Widget from "../components/Widget";
import CPU from "../components/Widgets/CPU";
import Network from "../components/Widgets/Network";
import Memory from "../components/Widgets/Memory";

const Dashboard = React.createClass(
  { render () {
      return (
        <main className="dashboard">
          <Widget>
            <CPU />
          </Widget>
          <Widget>
            <Network />
          </Widget>
          <Widget>
            <Memory />
          </Widget>
        </main>
      );
    }
  }
);

export default Dashboard;
