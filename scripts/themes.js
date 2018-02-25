

function loadThemes()
{
    repository.GetValueInExtensionDataPerUser("DropPlanTheme");
}

function changeTheme(css){
    $("#themeCss").remove();

    if (css != '') $("head").append("<link id='themeCss' href='" + css +"' rel='stylesheet'></link>");        
    repository.SetValueInExtensionDataPerUser("DropPlanTheme", css, 1000);
}

