// We now load the theme as a "UserSetting" in the repo.

function changeTheme(css, save){
    $("#themeCss").remove();
    if (css =="") css = "modern";
    $("head").append("<link id='themeCss' href='styles/" + css +".css' rel='stylesheet'></link>");
    if (save) repository.SetValueInExtensionDataPerUser("DropPlanTheme", css);
}

