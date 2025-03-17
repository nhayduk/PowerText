'use strict';

// GLOBAL CONSTANTS
var ATE_CONST = {
  APP_VERSION: '1.0.0'               // App version to check against database
  , APP_BACKUP_KEY: 'autoTextExpanderBackup'
  , APP_BACKUP_TIMESTAMP_KEY: 'autoTextExpanderBackupTimestamp'
  , APP_EMERGENCY_BACKUP_KEY: 'autoTextExpanderEmergencyBackup'
  , APP_ID_PRODUCTION: 'abbedfhgcpfnmhonjhdlmndigalhandb'
  , SHORTCUT_PREFIX: '@'             // Prefix for shortcuts, vs metadata
  , SHORTCUT_TIMEOUT_KEY: 'scto'     // Synced key for shortcut typing timeout
  , SHORTCUT_VERSION_KEY: 'v#'       // Synced key for shortcut database version
  , INSERT_CLIPBOARD_TAG: '%clip%'   // Tag to paste clipboard contents in
  , INSERT_URL_TAG: '%url%'          // Tag to insert current URL in
  , INSERT_DATE_TAG: '%d\\('           // Tag to insert date from moment.js
  , INSERT_DATE_CLOSE_TAG: ')'       // Closing tag for insert-date
  , INSERT_MDA_TAG: '%mda\\('           // Tag to ...
  , INSERT_MDA_CLOSE_TAG: ')'       // Closing tag ... 
  , CURSOR_TRACKING_TAG: '?atec?'    // Way to track cursor location
};
ATE_CONST.CURSOR_TRACKING_HTML = (function () {
  if (typeof document !== 'undefined') { 
    var el = document.createElement('div');
    el.appendChild(document.createComment(ATE_CONST.CURSOR_TRACKING_TAG));
    return el.innerHTML;
  }
  return ''; // Return empty string if document is not available
})();
var DEBUG = (!chrome || chrome.i18n.getMessage('@@extension_id') !== ATE_CONST.APP_ID_PROD);
