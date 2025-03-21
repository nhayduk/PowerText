// Prevent conflicts with other libraries, including other jQuery versions
var ateJQ = jQuery.noConflict(true);

// AutoTextExpander module, passed jQuery object by doc ready
var ateModule = (function($)
{
  // Variables & Constants
  var KEYCODE_BACKSPACE = 8
    , KEYCODE_TAB = 9
    , KEYCODE_RETURN = 13
    , KEYCODE_SPACEBAR = 32

    , DEFAULT_CLEAR_BUFFER_TIMEOUT = 750
    , TIME_EDITOR_CHECK = 500
    , ANIMATION_FAST = 200
    , ANIMATION_NORMAL = 400
    , ANIMATION_SLOW = 1000
    , TIME_SHOW_CROUTON = 1000 * 3	              // Show croutons for 3s

    , ENUM_CAPITALIZATION_NONE = 0
    , ENUM_CAPITALIZATION_FIRST = 1
    , ENUM_CAPITALIZATION_ALL = 2

    , DATE_MACRO_REGEX = new RegExp(ATE_CONST.INSERT_DATE_TAG, 'g')
    , MDA_MACRO_REGEX = new RegExp(ATE_CONST.INSERT_MDA_TAG, 'g')
    , CLIP_MACRO_REGEX = new RegExp(ATE_CONST.INSERT_CLIPBOARD_TAG, 'g')
    , URL_MACRO_REGEX = new RegExp(ATE_CONST.INSERT_URL_TAG, 'g')
    , WHITESPACE_REGEX = /(\s)/

    , BASECAMP_DOMAIN_REGEX = /basecamp.com/
    , EVERNOTE_DOMAIN_REGEX = /evernote.com/
    , FACEBOOK_DOMAIN_REGEX = /facebook.com/
    , GMAIL_DOMAIN_REGEX = /mail.google.com/
    , INBOX_DOMAIN_REGEX = /inbox.google.com/
    , GDOCS_DOMAIN_REGEX = /docs.google.com/
    , GPLUS_DOMAIN_REGEX = /plus.google.com/
    , GTT_DOMAIN_REGEX = /translate.google.com/
    , OUTLOOK_DOMAIN_REGEX = /mail.live.com/
    , ATLASSIAN_DOMAIN_REGEX = /atlassian.net/
    , ZENDESK_DOMAIN_REGEX = /zendesk.com/
    , CKE_EDITOR_REGEX = /(admin.mailchimp.com)|(salesforce.com)/

    , EVENT_NAME_KEYPRESS = 'keypress.auto-expander'
    , EVENT_NAME_KEYUP = 'keyup.auto-expander'
    , EVENT_NAME_BLUR = 'blur.auto-expander'
    , EVENT_NAME_CLICK = 'click.auto-expander'
    , EVENT_NAME_FOCUS = 'focus.auto-expander'
    , EVENT_NAME_LOAD = 'load.auto-expander'
    , EVENT_NAME_INSERTED = 'DOMNodeInserted'

    , SELECTOR_INPUT = '*[contenteditable=true]:not([data-atx=false]),textarea,input'
    , SELECTOR_GMAIL_EDIT = 'div.aoI'   // Class for Gmail's popup message composer
    , SELECTOR_INBOX_EDIT = 'div.dX'    // Class for Inbox's inline reply container
    , SELECTOR_GDOCS_EDIT = 'iframe.docs-texteventtarget-iframe'  // Google Docs
    , SELECTOR_GTT_EDIT = 'div.goog-splitpane-second-container'   // GTT editor
    , SELECTOR_OUTLOOK_EDIT = '#ComposeRteEditor_surface'   // Outlook web editor
    , SELECTOR_EVERNOTE_EDIT = 'gwt-debug-NoteContentEditorView-root'  // Evernote web note editor
    , SELECTOR_BASECAMP_EDIT = 'iframe.wysihtml5-sandbox'   // Basecamp message editor
    , SELECTOR_ATLASSIAN_EDIT = 'iframe#wysiwygTextarea_ifr'   // Confluence editor
    , SELECTOR_ZENDESK_INBOX_EDIT = 'iframe#ticket_comment_body_ifr'   // Zendesk Inbox editor
    , SELECTOR_CKE_EDIT = 'iframe.cke_wysiwyg_frame'  // CKEditor
  ;

  var typingBuffer = []   // Keep track of what's been typed before timeout
    , typingTimer         // Keep track of time between keypresses
    , typingTimeout       // Delay before we clear buffer
    , keyPressEvent       // Keep track of keypress event to prevent re-firing
    , keyUpEvent          // Keep track of keyup event to prevent re-firing
    , clipboard           // Keep track of what's in the clipboard
    , disableShortcuts    // Flag to disable shortcuts in unreliable state
  ;

  // Initialize module
  function init()
  {
    checkShortcutVersion(); // Check version of shortcuts database
    updateBufferTimeout();  // Get custom timeout for clearing typing buffer
    addListeners();         // Add listener to track when user types
	}

  // When user presses a key
  function keyPressHandler(event)
  {
    console.log('keyPressHandler:', event.target);

    // Make sure it's not the same event firing over and over again
    if (keyPressEvent == event) {
      return;
    } else {
      keyPressEvent = event;
    }

    // Get character that was typed
    var charCode = event.keyCode || event.which;
    if (charCode == KEYCODE_RETURN) {	// If return, clear and get out
      return clearTypingBuffer();
    }

    // Clear timer if still running, and start it again
    clearTypingTimer();
    typingTimer = setTimeout(clearTypingBuffer, typingTimeout);

    // Add new character to typing buffer
    var char = String.fromCharCode(charCode);
    typingBuffer.push(char);

    // Check typed text for shortcuts
    checkShortcuts(typingBuffer.join(''), char, event.target);
  }

  // When user lifts up on a key, to catch backspace
  function keyUpHandler(event)
  {
    // Make sure it's not the same event firing over and over again
    if (keyUpEvent == event) {
      return;
    } else {
      keyUpEvent = event;
    }

    // Get key that was lifted on
    var charCode = event.keyCode || event.which;

    // When user types backspace, pop character off buffer
    if (charCode == KEYCODE_BACKSPACE)
    {
      // Clear timer and restart
      clearTypingTimer();
      typingTimer = setTimeout(clearTypingBuffer, typingTimeout);

      // Remove last character typed
      typingBuffer.pop();
    }

    // If user uses tab or return, clear and get out
    if (charCode == KEYCODE_TAB || charCode == KEYCODE_RETURN) {
      return clearTypingBuffer();
    }
  }

  // Updates buffer clear timeout from custom value
  function updateBufferTimeout()
  {
    chrome.storage.sync.get(ATE_CONST.SHORTCUT_TIMEOUT_KEY, function (data)
    {
      // Check for errors
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
      }
      // Check that data is returned and shortcut library exists
      else if (data && Object.keys(data).length) {
        typingTimeout = data[ATE_CONST.SHORTCUT_TIMEOUT_KEY];
      } else {  // Use default value on error / no custom value set
        typingTimeout = DEFAULT_CLEAR_BUFFER_TIMEOUT;
      }
    });
  }

  // Clears the typing timer
  function clearTypingTimer()
  {
    // Clear timer handle
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
  }

  // Clears the typing buffer
  function clearTypingBuffer(event)
  {
    // Clear timer
    clearTypingTimer();

    // Clear buffer
    typingBuffer.length = 0;
  }

  // Check to see if text in argument corresponds to any shortcuts
  function checkShortcuts(shortcut, lastChar, textInput)
  {
    console.log('checkShortcuts:', lastChar, shortcut);

    var isAllCaps = (shortcut == shortcut.toUpperCase());   // Check for all caps
    var shortcutKey = ATE_CONST.SHORTCUT_PREFIX + shortcut;           // Key for expansion
    var shortcutKeyLowercase = ATE_CONST.SHORTCUT_PREFIX + shortcut.toLowerCase(); // For auto-capitalization

    // Get shortcuts
    chrome.storage.sync.get(shortcutKey, function (data)
    {
      // Check for errors
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
      }
      // Check that data is returned and shortcut exists
      else if (data && Object.keys(data).length)
      {
        processAutoTextExpansion(shortcut, data[shortcutKey], lastChar, textInput);
      }

      // No expansion for the shortcut, see if case is different
      else if (shortcutKeyLowercase != shortcutKey)
      {
        // Check to see if there is a result lowercase version,
        //  and if yes, then do auto-capitalization instead
        chrome.storage.sync.get(shortcutKeyLowercase, function (data)
        {
          // Check for errors
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
          }
          // Check that data is returned and shortcut exists
          else if (data && Object.keys(data).length)
          {
            processAutoTextExpansion(shortcut,
              data[shortcutKeyLowercase],
              lastChar,
              textInput,
              (isAllCaps ? ENUM_CAPITALIZATION_ALL : ENUM_CAPITALIZATION_FIRST)
            );
          }
        });
      }

      // If last character is whitespace, clear buffer
      if (WHITESPACE_REGEX.test(lastChar)) {
        clearTypingBuffer();
      }
    });
  }

  // Process autotext expansion and replace text
  function processAutoTextExpansion(shortcut, autotext, lastChar, textInput, capitalization)
  {
    console.log('processAutoTextExpansion:', autotext, capitalization);

    // Check if shortcut exists and should be triggered
    if (autotext && textInput)
    {
      // Check for version changes
      checkShortcutVersion();

      // If shortcuts are disabled, abort early
      if (disableShortcuts) {
        return;
      }

      // Update / get clipboard text
      getClipboardData(function()
      {
        // Handle clipboard pastes
        autotext = processClips(autotext);

        // Handle moment.js dates
        autotext = processDates(autotext);

        // Handle %url% macro
        autotext = processUrls(autotext);

        // Handle mda
        autotext = processMda(autotext, shortcut, function(autotext) {

          // Adjust capitalization
          switch (capitalization)
          {
            case ENUM_CAPITALIZATION_FIRST:
              autotext = autotext.charAt(0).toUpperCase() + autotext.slice(1);
              break;

            case ENUM_CAPITALIZATION_ALL:
              autotext = autotext.toUpperCase();
              break;

            default: break;
          }

          // Setup for processing
          var domain = window.location.host;
          console.log('textInput: ', textInput);

          // If input or textarea field, can easily change the val
          if (textInput.nodeName == 'TEXTAREA' || textInput.nodeName == 'INPUT' || textInput.nodeName == 'SPAN' || textInput.nodeName == 'P')
          {
            // Add whitespace if was last character
            if (WHITESPACE_REGEX.test(lastChar)) {
              autotext += lastChar;
            }

            replaceTextRegular(shortcut, autotext, textInput);
          }
          else	// Trouble... editable divs & special cases
          {
            // Add whitespace if was last character
            if (lastChar == ' ') {
              autotext += '&nbsp;';
            } else if (lastChar == '\t') {
              autoText += '&#9;';
            }

            // Check special domains
            if (FACEBOOK_DOMAIN_REGEX.test(domain)) {
              replaceTextFacebook(shortcut, autotext, textInput);
            } else if (OUTLOOK_DOMAIN_REGEX.test(domain)) {
              replaceTextOutlook(shortcut, autotext);
            } else if (EVERNOTE_DOMAIN_REGEX.test(domain)) {
              replaceTextEvernote(shortcut, autotext);
            } else if (GTT_DOMAIN_REGEX.test(domain)) {
              replaceTextGTT(shortcut, autotext);
          // } else if (GDOCS_DOMAIN_REGEX.test(domain)) {
          //   replaceTextGDOCS(shortcut, autotext);
            } else if (ATLASSIAN_DOMAIN_REGEX.test(domain)) {
              replaceTextAtlassian(shortcut, autotext);
            } else if (BASECAMP_DOMAIN_REGEX.test(domain)) {
              replaceTextBasecamp(shortcut, autotext);
            } else if (ZENDESK_DOMAIN_REGEX.test(domain)) {
              replaceTextZendesk(shortcut, autotext);
            } else if (CKE_EDITOR_REGEX.test(domain)) {
              replaceTextCKE(shortcut, autotext);
            } else {
              console.log('Domain:', domain);
              replaceTextContentEditable(shortcut, autotext, findFocusedNode());
            }
          }

          // Always clear the buffer after a shortcut fires
          clearTypingBuffer();
		});
      });	// END - getClipboardData()
    }	// END - if (autotext)
    else {  // Error
      console.log('Invalid input, missing autotext or textinput parameters.');
    }
  }

  // Specific handler for regular textarea and input elements
  function replaceTextRegular(shortcut, autotext, textInput)
  {
    var cursorPosition = getCursorPosition(textInput);

    // Fix for input[type=email] and input[type=number]
    if (cursorPosition === 0 && (textInput.nodeName == 'INPUT' || textInput.nodeName == 'SPAN'))
    {
      var type = textInput.getAttribute('type').toUpperCase();
      if (type == 'EMAIL' || type == 'NUMBER') {
        cursorPosition = textInput.value.length;
      }
    }

    textInput.value = replaceText(
      textInput.value,
      shortcut,
      autotext,
      cursorPosition
    );
    // Thanks to @briantingtc: mock and dispatch dom event when replacing text in input to correct for interactions with a React controlled input.
    textInput.dispatchEvent(new Event('input', {
      'bubbles': true,
      'cancelable': true
    }));
    setCursorPosition(textInput, cursorPosition - shortcut.length + autotext.length);
  }

  // Specific handler for Facebook element replacements
  function replaceTextFacebook(shortcut, autotext, textInput)
  {
    console.log('Domain: Facebook');

    var text;
    var cursorPosition = getCursorPosition(textInput);

    // Check if it is the search bar vs comments
    if (hasParentSelector(textInput, 'div', ['textInput']))
    {
      console.log('facebook search bar');
      var span = textInput.querySelector('span'); // Can only get collection
      if (span) {
        textInput = span;
      }

      // Get text and replace it
      text = textInput.textContent;
      textInput.textContent = replaceText(
        text,
        shortcut,
        autotext,
        cursorPosition
      );

      // Set new cursor position
      setCursorPosition(textInput, cursorPosition - shortcut.length + autotext.length);
    }
    else if (hasParentSelector(textInput,'div', ['UFICommentContainer'])) {
      console.log('facebook comments');  // doesn't work, due to ReactJS framework
    }
    else
    {
      // Get text and replace it
      text = textInput.textContent;
      textInput.textContent = replaceText(
        text,
        shortcut,
        autotext,
        cursorPosition
      );

      // Set new cursor position
      setCursorPosition(textInput,
        cursorPosition - shortcut.length + autotext.length);
    }
  }

  // Specific handler for Basecamp iframe replacements
  function replaceTextBasecamp(shortcut, autotext)
  {
    console.log('Domain: Basecamp');

    // Get the focused / selected text node
    var iframeWindow = document.querySelector(SELECTOR_BASECAMP_EDIT).contentWindow;
    var node = findFocusedNode(iframeWindow);
    console.log('node:', node);

    // Pass onto editable iframe text handler
    replaceTextContentEditable(shortcut, autotext, node, iframeWindow);
  }

  // Specific handler for Outlook iframe replacements
  function replaceTextOutlook(shortcut, autotext)
  {
    console.log('Domain: Outlook');

    // Get the focused / selected text node
    var iframeWindow = document.getElementById(SELECTOR_OUTLOOK_EDIT.substr(1))
      .contentWindow; // Need to cut off the # sign
    var node = findFocusedNode(iframeWindow);
    console.log('node:', node);

    // Pass onto editable iframe text handler
    replaceTextContentEditable(shortcut, autotext, node, iframeWindow);
  }

  // Specific handler for Evernote iframe replacements
  function replaceTextEvernote(shortcut, autotext)
  {
    console.log('Domain: Evernote');

    // Get the focused / selected text node
    var iframeWindow = document.getElementById(SELECTOR_EVERNOTE_EDIT)
      .querySelector('iframe').contentWindow;
    var node = findFocusedNode(iframeWindow);
    console.log('node:', node);

    // Pass onto editable iframe text handler
    replaceTextContentEditable(shortcut, autotext, node, iframeWindow);
  }

  // Specific handler for Google Translate iframe text replacements
  function replaceTextGTT(shortcut, autotext)
  {
    console.log('Domain: Google Translate');

    // Get the focused / selected text node
    var iframeWindow = document.querySelector(SELECTOR_GTT_EDIT)
      .querySelector('iframe').contentWindow;
    var node = findFocusedNode(iframeWindow);
    console.log('node:', node);

    // Pass onto editable iframe text handler
    replaceTextContentEditable(shortcut, autotext, node, iframeWindow);
  }

  // Specific handler for Google Docs iframe text replacements
  function replaceTextGDOCS(shortcut, autotext)
  {
    console.log('Domain: Google Docs');

    // Get the focused / selected text node
    var iframeWindow = document.querySelector(SELECTOR_GDOCS_EDIT).contentWindow;
    var node = findFocusedNode(iframeWindow);
    console.log('node:', node);

    // We can catch the text / event, but we can't seem to replace
    // or dispatch events to create the additional text

    // var e = $.Event('keydown');
    // e.which = 65; // Character 'A'
    // $(node).trigger(e);
    // $(node).trigger(e);
    // $(node).trigger(e);
    // $(node).trigger(e);

    //// Custom logic
    // var textInput = node;
    // console.log(textInput);
    //
    // // Get and process text, update cursor position
    // var text = replaceHTML(node.textContent, shortcut, autotext, 0)
    //   , multiline = false
    //   , lines
    // ;
    //
    // // If autotext is multiline text, split by newlines, join with <br> tag instead
    // if (autotext.indexOf('\n') >= 0)
    // {
    //   lines = text.split('\n');
    //   text = lines.join('<br>');
    //   multiline = true;
    // }
    //
    // // A way to insert HTML into a content editable div with raw JS.
    // //  Creates an element with the HTML content, then transfers node by node
    // //  to a new Document Fragment that replaces old node
    // //  Source from: http://stackoverflow.com/questions/6690752/insert-html-at-caret-in-a-contenteditable-div
    // var el = document.createElement('div')          // Used to store HTML
    //   , frag = document.createDocumentFragment()  // To replace old node
    //   , cursorNode;                               // To track cursor position
    // el.innerHTML = text;                            // Set HTML to div, then move to frag
    // for (var tempNode; tempNode = el.firstChild; frag.appendChild(tempNode))
    // {
    //   console.log(tempNode.nodeType, tempNode);
    //   if (tempNode.nodeType === Node.COMMENT_NODE
    //     && tempNode.nodeValue == ATE_CONST.CURSOR_TRACKING_TAG) {
    //     cursorNode = tempNode;
    //   }
    // }
    // textInput.appendChild(frag);             // add fragment of text
    //
    // // Set cursor position based off tracking node (or last child if we
    // //  weren't able to find the cursor tracker), then remove tracking node
    // if (cursorNode) {
    //   cursorNode.parentNode.removeChild(cursorNode);
    // }
  }

  // Specific handler for Atlassian frame editor text replacements
  function replaceTextAtlassian(shortcut, autotext)
  {
    console.log('Domain: Atlassian');

    // Get the focused / selected text node
    var iframeWindow = document.querySelector(SELECTOR_ATLASSIAN_EDIT).contentWindow;
    var node = findFocusedNode(iframeWindow);
    console.log('node:', node);

    // Pass onto editable iframe text handler
    replaceTextContentEditable(shortcut, autotext, node, iframeWindow);
  }

  // Specific handler for Zendesk Inbox frame editor text replacements
  function replaceTextZendesk(shortcut, autotext)
  {
    console.log('Domain: Zendesk');

    if (document.querySelector(SELECTOR_ZENDESK_INBOX_EDIT)) {
      // Get the focused / selected text node
      var iframeWindow = document.querySelector(SELECTOR_ZENDESK_INBOX_EDIT).contentWindow;
      var node = findFocusedNode(iframeWindow);
      console.log('node:', node);

      // Pass onto editable iframe text handler
      replaceTextContentEditable(shortcut, autotext, node, iframeWindow);
    } else {
      // To make it work with Zendesk's rich text editor
      replaceTextContentEditable(shortcut, autotext, findFocusedNode());
    }
  }

  // Specific handler for CKEditor iframe replacements
  function replaceTextCKE(shortcut, autotext)
  {
    console.log('Editor: CKE');

    // Get the focused / selected text node
    var iframeWindow = document.querySelector(SELECTOR_CKE_EDIT)
      .contentWindow;
    var node = findFocusedNode(iframeWindow);
    console.log('node:', node);

    // Pass onto editable iframe text handler
    replaceTextContentEditable(shortcut, autotext, node, iframeWindow);
  }


  // Reusable handler for editable iframe text replacements
  function replaceTextContentEditable(shortcut, autotext, node, win)
  {
    // Find focused div instead of what's receiving events
    var textInput = node.parentNode;
    console.log(textInput);

    // Get and process text, update cursor position
    var cursorPosition = getCursorPosition(textInput, win)
      , text = replaceHTML(node.textContent, shortcut, autotext, cursorPosition)
      , multiline = false
      , lines
    ;

    // If autotext is multiline text, split by newlines, join with <br> tag instead
    if (autotext.indexOf('\n') >= 0)
    {
      lines = text.split('\n');
      text = lines.join('<br>');
      multiline = true;
    }

    // A way to insert HTML into a content editable div with raw JS.
    //  Creates an element with the HTML content, then transfers node by node
    //  to a new Document Fragment that replaces old node
    //  Source from: http://stackoverflow.com/questions/6690752/insert-html-at-caret-in-a-contenteditable-div
    var el = document.createElement('div')          // Used to store HTML
      , frag = document.createDocumentFragment()  // To replace old node
      , cursorNode;                               // To track cursor position
    el.innerHTML = text;                            // Set HTML to div, then move to frag
    for (var tempNode; tempNode = el.firstChild; frag.appendChild(tempNode))
    {
      console.log(tempNode.nodeType, tempNode);
      if (tempNode.nodeType === Node.COMMENT_NODE
        && tempNode.nodeValue == ATE_CONST.CURSOR_TRACKING_TAG) {
        cursorNode = tempNode;
      }
    }
    textInput.replaceChild(frag, node);             // Replace old node with frag

    // Set cursor position based off tracking node (or last child if we
    //  weren't able to find the cursor tracker), then remove tracking node
    setCursorPositionAfterNode(cursorNode || textInput.lastChild, win);
    if (cursorNode) {
      cursorNode.parentNode.removeChild(cursorNode);
    }
  }

  // Replacing shortcut with autotext in text at cursorPosition
  function replaceText(text, shortcut, autotext, cursorPosition)
  {
    console.log('cursorPosition:', cursorPosition);
    console.log('currentText:', text);
    console.log('shortcut:', shortcut);
    console.log('expandedText:', autotext);

    // Replace shortcut based off cursorPosition
    return [text.slice(0, cursorPosition - shortcut.length),
      autotext, text.slice(cursorPosition)].join('');
  }

  // Replacing shortcut with autotext HTML content at cursorPosition
  function replaceHTML(text, shortcut, autotext, cursorPosition)
  {
    console.log('cursorPosition:', cursorPosition);
    console.log('currentText:', text);
    console.log('shortcut:', shortcut);
    console.log('expandedText:', autotext);

    // If autotext expansion already has cursor tag in it, don't insert
    var cursorTag = (autotext.indexOf(ATE_CONST.CURSOR_TRACKING_HTML) >= 0)
      ? '' : ATE_CONST.CURSOR_TRACKING_HTML;

    // Replace shortcut based off cursorPosition,
    //  insert tracking tag for cursor if it isn't already defined in autotext
    return [text.slice(0, cursorPosition - shortcut.length),
      autotext, cursorTag, text.slice(cursorPosition)].join('');
  }

    // Find node that has text contents that matches text
  function findMatchingTextNode(div, text)
  {
    return $(div).contents().filter(function() {
      return (this.nodeType == Node.TEXT_NODE)	    // Return all text nodes
        && (this.nodeValue.length == text.length);	// with same text length
    }).filter(function() {
      return (this.nodeValue == text);	// Filter for same text
    }).first().get(0);
  }

  // Find node that user is editing right now, for editable divs
  //  Optional passed window to perform selection find on
  function findFocusedNode(win)
  {
    // Use default window if not given window to search in
    if (!win) {
      win = window;
    }

    // Look for selection
    if (win.getSelection) {
      var selection = win.getSelection();
      if (selection.rangeCount) {
        return selection.getRangeAt(0).startContainer;
      }
    }
    return null;
  }

  // Returns the first match for a parent matching the given tag and classes.
  //  Tag parameter should be a string, el is the element to query on, and
  //  classes should be an array of strings of the names of the classes.
  function hasParentSelector(el, tag, classes)
  {
    tag = tag.toUpperCase();
    var found = false;
    while (el.parentNode && !found)
    {
      el = el.parentNode;     // Check parent
      if (el && el.tagName == tag) {
        for (var i = 0; i < classes.length; i++)
        {
          if (!el.classList.contains(classes[i])) {
            break;
          }
          found = true;   // Found = true if element has all classes
          break;          // Break to while loop
        }
      }
    }
    return el;
  }

  // Cross-browser solution for getting cursor position
  function getCursorPosition(el, win, doc)
  {
    var pos = 0, sel;
    if (!win) {
      win = window;
    }
    if (!doc) {
      doc = document;
    }
    if (el.nodeName == 'INPUT' || el.nodeName == 'TEXTAREA' || el.nodeName == 'SPAN')
    {
      try { 	// Needed for new input[type=email] failing
        pos = el.selectionStart;
      } catch (exception) {
        console.log('getCursorPosition:', exception);
      }
    }
    else	// Other elements
    {
      sel = win.getSelection();
      if (sel.rangeCount) {
        pos = sel.getRangeAt(0).endOffset;
      }
    }
    return pos;
  }


  // Cross-browser solution for setting cursor position
  function setCursorPosition(el, pos)
  {
    console.log('setCursorPosition:', pos);
    var sel, range;
    if (el.nodeName == 'INPUT' || el.nodeName == 'TEXTAREA' || el.nodeName == 'SPAN') {
      try {	// Needed for new input[type=email] failing
        if (el.setSelectionRange) {
          el.setSelectionRange(pos, pos);
        } else if (el.createTextRange) {
          range = el.createTextRange();
          range.collapse(true);
          range.moveEnd('character', pos);
          range.moveStart('character', pos);
          range.select();
        }
      } catch (exception) {
        console.log('setCursorPosition', exception);
      }
    } else {	// Other elements
      var node = el.childNodes[0];	// Need to get text node
      if (window.getSelection && document.createRange) {
        range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(true);
        range.setEnd(node, pos);
        range.setStart(node, pos);
        sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } else if (document.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(el);
        range.collapse(true);
        range.setEnd(node, pos);
        range.setStart(node, pos);
        range.select();
      }
    }
  }

  // Sets cursor position after a specific node, and optional
  //  parameter to set what the window/document should be
  function setCursorPositionAfterNode(node, win, doc)
  {
    console.log('setCursorPositionAfterNode:', node);

    // Setup variables
    var sel, range;
    if (!win) {
      win = window;
    }
    if (!doc) {
      doc = document;
    }

    // Check for getSelection(), if not available, try createTextRange
    if (win.getSelection && doc.createRange)
    {
      range = doc.createRange();
      range.setStartAfter(node);
      range.collapse(true);
      sel = win.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    else if (doc.body.createTextRange)
    {
      range = doc.body.createTextRange();
      range.setStartAfter(node);
      range.collapse(true);
      range.select();
    }
  }

  // Sets cursor position for a specific node, and optional
  //  parameter to set what the window/document should be
  function setCursorPositionInNode(node, pos, win, doc)
  {
    console.log('setCursorPositionInNode:', pos);

    // Setup variables
    var sel, range;
    if (!win) {
      win = window;
    }
    if (!doc) {
      doc = document;
    }

    // Check for getSelection(), if not available, try createTextRange
    if (win.getSelection && doc.createRange)
    {
      range = doc.createRange();
      range.setEnd(node, pos);
      range.setStart(node, pos);
      sel = win.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    else if (doc.body.createTextRange)
    {
      range = doc.body.createTextRange();
      range.setEnd(node, pos);
      range.setStart(node, pos);
      range.select();
    }
  }

  // Process and replace %url% tags with content from current url
  function processUrls(text)
  {
    var url = window.location.href;
    return text.replace(URL_MACRO_REGEX, url);
  }

  // Process and replace clip tags with content from clipboard
  function processClips(text)
  {
    console.log('processClips', text);

    // Find all indices of opening tags
    var clipTags = [];
    while (result = CLIP_MACRO_REGEX.exec(text)) {
      clipTags.push(result.index);
    }

    // Only continue if we have any tags
    if (!clipTags.length) {
      return text;
    }
    console.log('clipTags:', clipTags);

    // Loop through and replace clip tags with clipboard pasted text
    var processedText = [text.slice(0, clipTags[0])];
    console.log(processedText);
    for (var i = 0, len = clipTags.length; i < len; ++i)
    {
      processedText.push(clipboard);
      console.log('pre', processedText);
      processedText.push(text.slice(clipTags[i] + 6,	// 6 for '%clip%'
        (i == len - 1) ? undefined : clipTags[i+1]));
      console.log('post', processedText);
    }

    // Return processed dates
    return processedText.join('');
  }

  // Process and replace date tags and formats with moment.js
  function processDates(text)
  {
    var dateOpenTags = [], dateCloseTags = [];

    // Find all indices of opening tags
    while (result = DATE_MACRO_REGEX.exec(text)) {
      dateOpenTags.push(result.index);
    }

    // Only continue if we have any tags
    if (!dateOpenTags.length) {
      return text;
    }

    // Find matching closing tag for each date
    for (var i = 0, len = dateOpenTags.length; i < len; ++i) {
      dateCloseTags[i] = text.indexOf(
        ATE_CONST.INSERT_DATE_CLOSE_TAG, dateOpenTags[i] + 1);
    }

    // Only continue if we have matching tags
    if (dateOpenTags.length != dateCloseTags.length) {
      return text;
    }

    // Set moment.js locale
    var mo = moment();
    mo.locale(chrome.i18n.getMessage('@@ui_locale'));

    // Loop through and replace date tags with formatted text
    var processedText = [text.slice(0, dateOpenTags[0])];
    for (var i = 0, len = dateOpenTags.length; i < len; ++i)
    {
      processedText.push(mo.format(text.slice(
        dateOpenTags[i] + 3, dateCloseTags[i])));		// 3 for '%d('
      processedText.push(text.slice(dateCloseTags[i] + 1,	// 1 for ')'
        (i == len - 1) ? undefined : dateOpenTags[i+1]));
    }

    // Return processed dates
    return processedText.join('');
  }

  // Process and replace ...
  async function processMda(text, shortcut, callback)
  { 
    var mdaOpenTags = [], mdaCloseTags = [];

    // Find all indices of opening tags
    while (result = MDA_MACRO_REGEX.exec(text)) {
      mdaOpenTags.push(result.index);
    }

    // Only continue if we have any tags
    if (!mdaOpenTags.length) {
      return callback(text);
    }

    // Find matching closing tag for each date
    for (var i = 0, len = mdaOpenTags.length; i < len; ++i) {
      mdaCloseTags[i] = text.indexOf(
        ATE_CONST.INSERT_MDA_CLOSE_TAG, mdaOpenTags[i] + 1);
    }

    // Only continue if we have matching tags
    if (mdaOpenTags.length != mdaCloseTags.length) {
      return callback(text);
    }

    // Loop through and replace date tags with formatted text
    var processedText = [text.slice(0, mdaOpenTags[0])];
    for (var i = 0, len = mdaOpenTags.length; i < len; ++i)
    {
      var attribute = text.slice(mdaOpenTags[i] + 5, mdaCloseTags[i]);
        
      var mdaValue = await new Promise((resolve, reject) => {
        var s = document.createElement('script');
        s.src = chrome.runtime.getURL('scripts/powerTextMda.js');
        s.onload = function() { 	
          this.remove();
          var mdaValueElement = document.getElementById('ec_mdavalue');
          resolve(mdaValueElement ? mdaValueElement.value : '');
		  mdaValueElement.remove();
	    };
        s.dataset.params = JSON.stringify({attribute: attribute});
        (document.head || document.documentElement).appendChild(s);
      });

      if (mdaValue) {
        processedText.push(mdaValue);
      } else {
        processedText.push(shortcut);
      }
    }

    // Return processed dates
    callback(processedText.join(''));
  }

  // Get what's stored in the clipboard
  function getClipboardData(completionBlock) {	
	navigator.clipboard.readText().then(function (textFromClipboard) {
	  console.log('getClipboardData:', textFromClipboard);
      clipboard = textFromClipboard;
      if (completionBlock) {
        completionBlock();
      }
	}, completionBlock);
  }

  // Add event listeners to specific container
  function refreshListenersOnContainer($target)
  {
    console.log('refreshListenersOnContainer:', $target);
    $target.off(EVENT_NAME_KEYPRESS).on(EVENT_NAME_KEYPRESS, SELECTOR_INPUT, keyPressHandler);
    $target.off(EVENT_NAME_KEYUP).on(EVENT_NAME_KEYUP, SELECTOR_INPUT, keyUpHandler);
    $target.off(EVENT_NAME_BLUR).on(EVENT_NAME_BLUR, SELECTOR_INPUT, clearTypingBuffer);
    $target.off(EVENT_NAME_CLICK).on(EVENT_NAME_CLICK, SELECTOR_INPUT, clearTypingBuffer);
  }

  // Add event listeners to specific element, without filtering on child elements
  function refreshListenersOnElement($target)
  {
    console.log('refreshListenersOnElement:', $target);
    $target.off(EVENT_NAME_KEYPRESS).on(EVENT_NAME_KEYPRESS, keyPressHandler);
    $target.off(EVENT_NAME_KEYUP).on(EVENT_NAME_KEYUP, keyUpHandler);
    $target.off(EVENT_NAME_BLUR).on(EVENT_NAME_BLUR, clearTypingBuffer);
    $target.off(EVENT_NAME_CLICK).on(EVENT_NAME_CLICK, clearTypingBuffer);
  }

  // Attach listener to keypresses
  function addListeners()
  {
    console.log('addListeners()');

    var $document = $(document);
    var domain = window.location.host;

    // Special case for Google Inbox
    if (INBOX_DOMAIN_REGEX.test(domain))
    {
      console.log('Domain: Google Inbox');
      SELECTOR_INPUT += ',' + SELECTOR_INBOX_EDIT;

      // Need to check for focus on editable elements
      $document.on(EVENT_NAME_FOCUS, SELECTOR_INPUT, function(event)
      {
        console.log('focused on editable element:', event.target);
        refreshListenersOnElement($(event.target));
      });
    }
    else    // Add to whole document
    {
      // Special case for Google Plus
      if (GPLUS_DOMAIN_REGEX.test(domain))
      {
        console.log('Domain: Google Plus');
        SELECTOR_INPUT += ',div.editable';
      }

      // Add default listeners to document
      console.log('adding default listeners to document');
      $document.on(EVENT_NAME_KEYPRESS, SELECTOR_INPUT, keyPressHandler);
      $document.on(EVENT_NAME_KEYUP, SELECTOR_INPUT, keyUpHandler);
      $document.on(EVENT_NAME_BLUR, SELECTOR_INPUT, clearTypingBuffer);
      $document.on(EVENT_NAME_CLICK, SELECTOR_INPUT, clearTypingBuffer);

      // Special case for Gmail.com
      if (GMAIL_DOMAIN_REGEX.test(domain))
      {
        console.log('Domain: Gmail');
        SELECTOR_INPUT += ',div.editable';

        // Need to check for focus on div.aoI
        $document.on(EVENT_NAME_FOCUS, SELECTOR_GMAIL_EDIT, function(event)
        {
          console.log('focused on message editor');

          // Check that it is the dialog
          var $target = $(event.target);
          if ($target.parents('div[role=dialog]').length) {
            refreshListenersOnContainer($target.parents(SELECTOR_GMAIL_EDIT));
          }
        });
      }

      // Special case for Google Docs
      // else if (GDOCS_DOMAIN_REGEX.test(domain))
      // {
      //   console.log('Domain: Google Docs');
      //
      //   // Annoying, need to check for existence of editor element
      //   var editorCheck = setInterval(function() {
      //     var $target = $(SELECTOR_GDOCS_EDIT);
      //     if ($target.length) {
      //       clearInterval(editorCheck);
      //       addListenersToIframe($target, true);
      //     }
      //   }, TIME_EDITOR_CHECK);
      // }

      // Special case for Outlook.com
      // else if (OUTLOOK_DOMAIN_REGEX.test(domain))
      // {
      //   console.log('Domain: Outlook');
      //
      //   // Annoying, need to check for existence of editor element
      //   var editorCheck = setInterval(function() {
      //     var $target = $(SELECTOR_OUTLOOK_EDIT);
      //     if ($target.length) {
      //       clearInterval(editorCheck);
      //       addListenersToIframe($target);
      //     }
      //   }, TIME_EDITOR_CHECK);
      // }

      // Special case for Google Translate
      // else if (GTT_DOMAIN_REGEX.test(domain))
      // {
      //   console.log('Domain: Google Translate');
      //
      //   // Annoying, need to check for existence of editor element
      //   var editorCheck = setInterval(function() {
      //     var $target = $(SELECTOR_GTT_EDIT);
      //     if ($target.length) {
      //       clearInterval(editorCheck);
      //       addListenersToIframe($target.find('iframe'));
      //     }
      //   }, TIME_EDITOR_CHECK);
      // }

      // Special case for Atlassian
      // else if (ATLASSIAN_DOMAIN_REGEX.test(domain))
      // {
      //   console.log('Domain: Atlassian');
      //
      //   // SUPER annoying, need to continually check for existence of editor iframe
      //   //  because the iframe gets recreated each time and starts with cross-origin
      //   var editorCheck = setInterval(function() {
      //     var $target = $(SELECTOR_ATLASSIAN_EDIT);
      //     if ($target.length) {
      //       addListenersToIframe($target);
      //     }
      //   }, TIME_EDITOR_CHECK);
      // }

      // Special case for Zendesk Inbox
      // else if (ZENDESK_DOMAIN_REGEX.test(domain))
      // {
      //   console.log('Domain: Zendesk');
      //
      //   // SUPER annoying, need to continually check for existence of editor iframe
      //   //  because the iframe gets recreated each time and starts with cross-origin
      //   var editorCheck = setInterval(function() {
      //     var $target = $(SELECTOR_ZENDESK_INBOX_EDIT);
      //     if ($target.length) {
      //       addListenersToIframe($target);
      //     }
      //   }, TIME_EDITOR_CHECK);
      // }

      // Special case for CKEditor
      // else if (CKE_EDITOR_REGEX.test(domain))
      // {
      //   console.log('Editor: CKEditor');
      //
      //   // SUPER annoying, need to continually check for existence of editor iframe
      //   //  because the iframe gets recreated each time and starts with cross-origin
      //   var editorCheck = setInterval(function() {
      //     var $target = $(SELECTOR_CKE_EDIT);
      //     if ($target.length) {
      //       addListenersToIframe($target);
      //     }
      //   }, TIME_EDITOR_CHECK);
      // }

    }

    // Attach to future iframes
    // $document.on(EVENT_NAME_INSERTED, function(event)
    // {
    // 	var $target = $(event.target);
    // 	if ($target.is('iframe'))
    //   {
    //     console.log('inserted:', $target);
    //     addListenersToIframe($target);
    // 	}
    // });

    // Attach to existing iframes as well - this needs to be at the end
    //  because sometimes this breaks depending on cross-domain policy
    // $document.find('iframe').each(function(index) {
    // 	addListenersToIframe($(this));
    // });
  }

  // Detach listener for keypresses
  function removeListeners()
  {
    $(document).off(EVENT_NAME_KEYPRESS);
    $(document).off(EVENT_NAME_KEYUP);
    $(document).off(EVENT_NAME_LOAD);
    $(document).off(EVENT_NAME_BLUR);
  }

  // Check shortcut database version matches app version
  function checkShortcutVersion()
  {
    chrome.storage.sync.get(ATE_CONST.SHORTCUT_VERSION_KEY, function (data)
    {
      // Check for errors
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
      }
      else if ((data && Object.keys(data).length)
        && data[ATE_CONST.SHORTCUT_VERSION_KEY] != ATE_CONST.APP_VERSION)   // If versions don't match up
      {
        // Alert users that shortcuts aren't synced yet, they should reload
        var warning = chrome.i18n.getMessage('WARNING_SHORTCUT_VERSION_MISMATCH')
          + '\n\n' + chrome.i18n.getMessage('WARNING_SHORTCUT_DISABLED');
        console.log(warning);
        console.log('Database version:', data[ATE_CONST.SHORTCUT_VERSION_KEY]);
        console.log('Extension version:', ATE_CONST.APP_VERSION);
        if (!disableShortcuts) {
          showCrouton(warning);
        }

        // Flag shortcuts disabled
        disableShortcuts = true;
      }
      else {    // All is well, set disableShortcuts flag to false
        disableShortcuts = false;
      }
    });
  }

  // Create and show a warning message crouton that can be dismissed or autohide
  function showCrouton(message, autohide)
  {
    // Create and style crouton
    var crouton = document.createElement('div');
    crouton.style['width'] = '100%';
    crouton.style['position'] = 'fixed';
    crouton.style['bottom'] = 0;
    crouton.style['left'] = 0;
    crouton.style['right'] = 0;
    crouton.style['padding'] = '4px 0';
    crouton.style['text-align'] = 'center';
    crouton.style['font'] = 'bold 13px/16px Verdana';
    crouton.style['color'] = '#fff';
    crouton.style['background-color'] = '#c66';
    crouton.style['opacity'] = '.8';

    // Add to body, add content
    var $crouton = $(crouton);
    $('body').append($crouton.text(message));

    if (autohide) {
      $crouton.delay(TIME_SHOW_CROUTON).remove();
    }
    else    // Show a close button
    {
      // Create and style close button
      var button = document.createElement('button');
      button.style['font'] = 'bold 13px/13px Verdana';
      button.style['margin'] = '0 6px';
      button.style['padding'] = '4px';
      button.style['float'] = 'right';

      // Add to body, add content, and actions
      $crouton.append($(button)
        .text('x')
        .click(function(e) {
          $(this).parent().remove();
        })
      );
    }
  }

  return {
    init: init,
    checkShortcutVersion: checkShortcutVersion,
    removeListeners: removeListeners,
    addListeners: addListeners,
    refreshListenersOnContainer: refreshListenersOnContainer,
    refreshListenersOnElement: refreshListenersOnElement,
    checkShortcuts: checkShortcuts,
  };
})(ateJQ);

if(window.self !== window.top) {
  //delay loading in iframes - this helps with ckeditor
  setTimeout(function() {
    // Document ready
    ateJQ(ateModule.init);
  }, 500);
} else {
  // Document ready
  ateJQ(ateModule.init);
}