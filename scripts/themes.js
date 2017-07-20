function SetValueInExtensionDataPerUser(key, value){
    // Get data service
    VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService) {
        // Set value in user scope
        dataService.setValue(key, value, {scopeType: "User"});
    });
}

function GetValueInExtensionDataPerUser(key){
    var res;
    // Get data service
    VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService) {
        // Get value in user scope
        dataService.getValue(key, {scopeType: "User"}).then(function(c) {
            if (c != "") {
                $("#themes").val(c);
                changeTheme(c);
            }
        });
    });
    return res;
}



function loadThemes()
{
    var c = GetValueInExtensionDataPerUser("DropPlanTheme");
   
}

function changeTheme(css){
    $("#themeCss").remove();

    if (css != '') $("head").append("<link id='themeCss' href='" + css +"' rel='stylesheet'></link>");        
    SetValueInExtensionDataPerUser("DropPlanTheme", css, 1000);
}

