var _dataService;

function SetValueInExtensionDataPerUser(key, value){
    _dataService.setValue(key, value, {scopeType: "User"});
}

function GetValueInExtensionDataPerUser(key){
    var res;
    _dataService.getValue(key, {scopeType: "User"}).then(function(c) {
        if (c != "") {
            $("#themes").val(c);
            changeTheme(c);
        }
    });
    return res;
}



function loadThemes()
{
    GetValueInExtensionDataPerUser("DropPlanTheme");
}

function changeTheme(css){
    $("#themeCss").remove();

    if (css != '') $("head").append("<link id='themeCss' href='" + css +"' rel='stylesheet'></link>");        
    SetValueInExtensionDataPerUser("DropPlanTheme", css, 1000);
}

