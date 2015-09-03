// Localization Settings
// ===========
// Display and modify Localization settings settings

"use strict";

import React from "react";
import TWBS from "react-bootstrap";
import _ from "lodash";

import inputHelpers from "../../../mixins/inputHelpers";

const languageChoices =
  [ "English"
  , "Afrikaans"
  , "Azerbaijani"
  , "Belarusian"
  , "Bengali"
  , "Breton"
  , "Bosnian"
  , "Catalan"
  , "Czech"
  , "Welsh"
  , "Danish"
  , "German"
  , "Greek"
  , "British English"
  , "Esperanto"
  , "Spanish"
  , "Argentinian Spanish"
  , "Mexican Spanish"
  , "Nicaraguan Spanish"
  , "Venezuelan Spanish"
  , "Estonian"
  , "Basque"
  , "Persian"
  , "Finnish"
  , "French"
  , "Frisian"
  , "Irish"
  , "Galician"
  , "Hebrew"
  , "Hindi"
  , "Croatian"
  , "Hungarian"
  , "Interlingua"
  , "Indonesian"
  , "Icelandic"
  , "Italian"
  , "Japanese"
  , "Georgian"
  , "Kazach"
  , "Khmer"
  , "Kannada"
  , "Korean"
  , "Luxembourish"
  , "Lithuanian"
  , "Latvian"
  , "Macedonian"
  , "Malayan"
  , "Mongolian"
  , "Burmese"
  , "Norwegian Bokmal"
  , "Nepali"
  , "Dutch"
  , "Norwegian Nyorsk"
  , "Ossetic"
  , "Punjabi"
  , "Polish"
  , "Portuguese"
  , "Brazilian Portuguese"
  , "Romanian"
  , "Russian"
  , "Slovak"
  , "Slovenian"
  , "Albanian"
  , "Serbian"
  , "Serbian Latin"
  , "Swedish"
  , "Swahili"
  , "Tamil"
  , "Telugu"
  , "Thai"
  , "Turkish"
  , "Tatar"
  , "Udmurt"
  , "Urdu"
  , "Vietnamese"
  , "Simplified Chinese"
  , "Traditional Chinese"
  ];

const LocalizationSettings = React.createClass(
  { mixins: [ inputHelpers ]

  , getDefaultProps () {
    return { language: ""
           , timezone: ""
           , timezoneList: []
           , debug: null
           };
  }

  , handleLocalizationChange( key, event ) {
    switch ( key ) {
      case "language":
        this.setState( { language: event.target.value } );
        break;
      case "timezone":
        this.setState( { timezone: event.target.value } );
        break;
    }
  }

  , render () {
    var language = null;
    var languageValue = this.props[ "language" ];
    var timezone = null;
    var timezoneValue = this.props[ "timezone" ];

    if ( _.has( this, [ "state", "language" ] ) ) {
      languageValue = this.state.language;
    }
    language =
      <TWBS.Input
        type = "select"
        label = "Language"
        value = { languageValue }
        onChange = { this.handleLocalizationChange.bind( this, "language" ) }>
        { this.createSimpleOptions( languageChoices ) }
      </TWBS.Input>;

    if ( _.has( this, [ "state", "timezone" ] ) ) {
      timezoneValue = this.state.language;
    }
    timezone =
      <TWBS.Input
        type = "select"
        label = "Timezone"
        value = { timezoneValue }
        onChange = { this.handleLocalizationChange.bind( this, "timezone" ) }>
        { this.createSimpleOptions( this.props.timezoneList ) }
      </TWBS.Input>;

    return (
      <TWBS.Panel>
        <h4>Localization</h4>
        <form className = "settings-config-form">
          { language }
          { timezone }
        </form>
      </TWBS.Panel>
    );
  }
});

export default LocalizationSettings;