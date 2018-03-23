

function loadThemes()
{
    repository.GetValueInExtensionDataPerUser("DropPlanTheme");
}

function changeTheme(css, save){
    $("#themeCss").remove();

    if (css != '') $("head").append("<link id='themeCss' href='" + css +"' rel='stylesheet'></link>");     
    if (save) repository.SetValueInExtensionDataPerUser("DropPlanTheme", css);
}

