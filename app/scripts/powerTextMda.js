(() => {
    const params = JSON.parse(document.currentScript.dataset.params);
    var xrm = window.top.Xrm;
    if (xrm) {
        var split = params.attribute.split(',');
        for (var i = 0; i < split.length; i++) {
            var attr = xrm.Page.getAttribute(split[i]); console.log(split[i]); console.log(attr);
            if (attr) {
                var str = null;
                switch (attr.getAttributeType()) {
                    case 'multiselectoptionset':
                    case 'optionset':
                        str = attr.getText();
                        break;
                    case 'datetime':
                        switch (attr.getFormat()) {
                            case 'date':
                                str = attr.getValue().format(Xrm.Utility.getGlobalContext().userSettings.dateFormattingInfo.ShortDatePattern);
                                break;
                            case 'datetime':
                                str = attr.getValue().format(Xrm.Utility.getGlobalContext().userSettings.dateFormattingInfo.FullDateTimePattern);
                                break;
                        }
                        break;
                    case 'lookup':
                        var val = attr.getValue();
                        if (val.length > 0) {
                            str = val[0].name;
                        }
                        break;
                    default:
                        str = attr.getValue();
                        break;
                }
                var inputTag = document.createElement('input');
                inputTag.setAttribute('type', 'text');    
                inputTag.setAttribute('id', 'ec_mdavalue');          
                document.body.appendChild(inputTag);
                inputTag.value = str;
                break;
            }
        }
    }
})();
