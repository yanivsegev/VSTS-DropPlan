var repository = new VSSSettingsRepository();
var showFailAlerts = true;

function reportProgress(msg){
    var messages = document.getElementById("messages");
    if (messages){
        messages.innerHTML = messages.innerHTML + msg + "<br/>";
    }
}

function alertUser(msg, e){
    if (!msg){
        msg = e?.serverError?.value?.Message || e?.message || "Unknown error";
    }

    var logMsg = "Alert User: [" + msg + "]";

    if (
            !(e?.message?.indexOf('Rule Error') > 0) // don't log "rule validation" errors
            && !(e?.message?.indexOf('Status code 0:') > 0) //don't log "server unavailable" errors
        )
    {
        console.error(logMsg, e);
    } else {
        console.log(logMsg, e);
    }
    if (showFailAlerts){
        if (!(e?.message?.indexOf('Status code 0:') > 0)){
            alert(msg);
        }
    }
}

function switchPlanningIssues(enabled){
    repository.highlightPlanningIssues = enabled;
}

function switchUsePBILevelForTasks(enabled){
    repository.usePBILevelForTasks = enabled;
}

function switchUseNewTimeManagement(enabled){
    repository.useNewTimeManagement = enabled;
}

function switchUseActivityTypeInDependencyTracking(enabled){
    repository.useActivityTypeInDependencyTracking = enabled;
}

function switchAllowSimultaneousSubsequentActivities(enabled){
    repository.allowSimultaneousSubsequentActivities = enabled;
}

try{
	repository.reportProgress = reportProgress;
	repository.reportFailure = reportProgress;
	repository.failToCallVss = reportProgress;
	repository.WorkItemsLoaded = reportProgress;
	repository.Init();
	repository.ready.then(()=>{
		const lists=SortableList();
		lists.setItems("first","Required activity order",repository.getActivityOrder());
		lists.setItems("first","No order enforced",repository.getUnorderedActivities());
		lists.onStateChanged=(newState) =>{
			repository.SetActivityOrder(newState[0].columns[0].data);
		}
        $('#showPlanningIssues').prop('checked', repository.highlightPlanningIssues);
        $('#usePBILevelForTasks').prop('checked', repository.usePBILevelForTasks);
        $('#useNewTimeManagement').prop('checked', repository.useNewTimeManagement);
        $('#useActivityTypeInDependencyTracking').prop('checked', repository.useActivityTypeInDependencyTracking);
        $('#allowSimultaneousSubsequentActivities').prop('checked', repository.allowSimultaneousSubsequentActivities);
		$("#settingsRoot").css("display","block");
		$(".messageBoxContainer").remove();
	});
} catch (error) {
	alertUser(undefined, error);
}