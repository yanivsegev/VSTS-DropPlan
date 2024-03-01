/// <reference types="vss-web-extension-sdk" />

function init(){
    console.log("Starting.");
    VSS.init({
        explicitNotifyLoaded: true,
        usePlatformScripts: false,
        usePlatformStyles: true,
        applyTheme: true,
    });
    console.log("Init complete.");
    VSS.ready(function () {
        // RegisterThemeEvent();
        VSS.register(VSS.getContribution().id, {});
        VSS.notifyLoadSucceeded();
        console.log("VSS init.");
    });

    loadValues();

}
function loadValues(){
    VSS.require(["TFS/WorkItemTracking/Services"], function(workItemServices) {
        workItemServices.WorkItemFormService.getService().then(function (workItemFormSvc) {
            if(workItemFormSvc.hasActiveWorkItem()) {
                console.log("Active work item is available.");

                workItemFormSvc.getFieldValues(["Microsoft.VSTS.Scheduling.StartDate","Microsoft.VSTS.Scheduling.FinishDate"])
                    .then((x) => {
                        console.log(x);
                        showValues(x["Microsoft.VSTS.Scheduling.StartDate"],x["Microsoft.VSTS.Scheduling.FinishDate"]);
                    });
            }
            else {
                console.log("Active work item is NOT available.");
            }
        });
    });
}

function showValues(StartDate, FinishDate){
    let msg = "";
    if (StartDate && FinishDate){
        msg = StartDate.getGMT().yyyy_mm_dd() + " to " + FinishDate.getGMT().yyyy_mm_dd()
    } else if (FinishDate) {
        msg = "StartDate was not set."
    } else if (StartDate) {
        msg = "FinishDate was not set."
    } else {
        msg = "StartDate and FinishDate were not set.";
    }
    console.log(msg);
    document.getElementById("plandates").innerText = msg;
}
init();