var repository = new VSSSettingsRepository();

window.addEventListener("message", receiveMessage, false);

function receiveMessage(event) {
    try {
		console.log("message received")
        var result = JSON.parse(event.data);
        if (result.result.fields) {
            console.log("Refresh.");
        }
        if (result.error)
        {
            console.log("Error in receiveMessage: " + result.error);
        }

    } catch (error) {

    }
}

function reportProgress(msg){
    var messages = document.getElementById("messages");
    if (messages){
        messages.innerHTML = messages.innerHTML + msg + "<br/>";
    }
}

function alertUser(msg, e){
    var logMsg = "Alert User: [" + msg + "]";
    console.log(msg);
    if (e) console.log(e);
    if (window._trackJs && typeof trackJs != "undefined") { trackJs.track(logMsg); }
    alert(msg);
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
			console.log(newState);
			repository.SetActivityOrder(newState[0].columns[0].data);
		}
		$("#settingsRoot").css("display","block");
		$(".messageBoxContainer").remove();
	});
} catch (error) {
	alertUser(error);
}