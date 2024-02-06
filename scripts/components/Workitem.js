function Workitem(workitem, _workItemTypes, _workItemPBITypes){
    
    this._workitem = workitem;
    
    this.Init = InitFunc;

    this.Init();

    this.SetOriginalAssignedTo = SetOriginalAssignedToFunc;
    
    function SetOriginalAssignedToFunc(value){
        this.OriginalAssignedTo = value;
        this.AssignedToDisplayName = this.OriginalAssignedTo?.displayName?.split("<")[0].trim() || "";
        this.AssignedToComboName = this.OriginalAssignedTo?.displayName ? this.OriginalAssignedTo.displayName + " <" + this.OriginalAssignedTo.uniqueName + ">" : "";
    }

    function InitFunc(){
        var workitem = this._workitem;

        this.Id = workitem.id;

        this.OriginalStartDate = workitem.fields["Microsoft.VSTS.Scheduling.StartDate"];
        this.OriginalFinishDate = workitem.fields["Microsoft.VSTS.Scheduling.FinishDate"]; 

        this.BacklogPriority = workitem.fields["Microsoft.VSTS.Common.BacklogPriority"];

        this.OriginalAssignedTo = workitem.fields["System.AssignedTo"];
        this.AssignedToDisplayName = this.OriginalAssignedTo?.displayName?.split("<")[0].trim() || "";
        this.AssignedToComboName = this.OriginalAssignedTo?.displayName ? this.OriginalAssignedTo.displayName + " <" + this.OriginalAssignedTo.uniqueName + ">" : "";
        this.InitialAssignedToComboName = this.AssignedToComboName;

        this.AreaPath = workitem.fields["System.AreaPath"] || "";

        // work out time tracking values
        this.OriginalEstimate = workitem.fields["Microsoft.VSTS.Scheduling.OriginalEstimate"] || 0;

        const completedWork = workitem.fields["Microsoft.VSTS.Scheduling.CompletedWork"];
        const remainingWork = workitem.fields["Microsoft.VSTS.Scheduling.RemainingWork"];

        if (!workitem.fields["Microsoft.VSTS.Common.ClosedBy"]) {
            // If the task is incomplete...

            if(completedWork != undefined && remainingWork != undefined) {
                this.TotalWork = completedWork + remainingWork;
            } else if (this.OriginalEstimate){ //if this is defined and non-zero use it, otherwise TotalWork will be undefined.
                this.TotalWork = (completedWork > this.OriginalEstimate) ? completedWork : this.OriginalEstimate;
            }

            // if we don't have a Completed work, calculate it from TotalWork and remaining.
            this.CompletedWork = completedWork || (this.TotalWork - remainingWork) || 0;

            // If we don't have a remaining work, but we do have a completed work, then we can calculate the remaining from the TotalWork
            this.RemainingWork = remainingWork || (this.TotalWork - this.CompletedWork) || 0;
        } else {
            // Task is completed so no work remains
            this.CompletedWork = completedWork || 0;
            this.TotalWork = this.CompletedWork ;
            this.RemainingWork = remainingWork || 0;
        }


        this.Blocked = workitem.fields["Microsoft.VSTS.CMMI.Blocked"];
        this.State = workitem.fields["System.State"];
        this.Title = workitem.fields["System.Title"];
        this.WorkItemType = workitem.fields["System.WorkItemType"];

        this.Relations = workitem.relations;

        if (this.OriginalStartDate) this.StartDate = new Date(this.OriginalStartDate).getGMT();
        if (this.OriginalFinishDate) this.FinishDate = new Date(this.OriginalFinishDate).getGMT();

        this.InitialStartDate = this.StartDate;
        this.InitialFinishDate = this.FinishDate;

        this.isTaskWit = jQuery.grep( _workItemTypes , function(element){ return element.name == workitem.fields["System.WorkItemType"]; }).length > 0;
        this.isPBIWit = jQuery.grep( _workItemPBITypes , function(element){ return element.name == workitem.fields["System.WorkItemType"]; }).length > 0;

        let workItemConfig = (this.isTaskWit ? _workItemTypes : _workItemPBITypes).find(function(itemType){ return itemType.name == workitem.fields["System.WorkItemType"]; });

        this.stateColor=undefined;
        this.workItemConfig=workItemConfig;
        if (workItemConfig && workItemConfig.states) {
            this.stateColor = workItemConfig.states.find(function(itemState){ return itemState.name == workitem.fields["System.State"]})?.color;
        }

        this.Activity = workitem.fields["Microsoft.VSTS.Common.Activity"];
        this.childActivities={};

        this.Tags = workitem.fields["System.Tags"];
    }

    this.GetParentId = function () {
        var parentId = -1;
        if (this._workitem.relations) {
            this._workitem.relations.forEach(function (item, index) {
                if (item.rel == "System.LinkTypes.Hierarchy-Reverse") {
                    parentId = item.url.substring(item.url.lastIndexOf("/") + 1)
                }
            });
        }
        return parentId;
    }

    this.GetPredecessorIds = function (){
        return this.GetRelatedIds("System.LinkTypes.Dependency-Reverse");
    }/*function () {
        var predecessorIds = [];
        if (this._workitem.relations) {
            predecessorIds = this._workitem.relations.filter(
                (relation) => relation.rel == "System.LinkTypes.Dependency-Reverse"
            ).map(
                (item) => item.url.substring(item.url.lastIndexOf("/") + 1)
            );
        }
        return predecessorIds;
    }*/

    this.GetSuccessorIds = function (){
        return this.GetRelatedIds("System.LinkTypes.Dependency-Forward");
    }
    /*function () {
        var predecessorIds = [];
        if (this._workitem.relations) {
            predecessorIds = this._workitem.relations.filter(
                (relation) => relation.rel == "System.LinkTypes.Dependency-Reverse"
            ).map(
                (item) => item.url.substring(item.url.lastIndexOf("/") + 1)
            );
        }
        return predecessorIds;
    }*/

    this.GetRelatedIds = function (relationType) {
        var Ids = [];
        if (this._workitem.relations) {
            Ids = this._workitem.relations.filter(
                (relation) => relation.rel == relationType
            ).map(
                (item) => item.url.substring(item.url.lastIndexOf("/") + 1)
            );
        }
        return Ids;
    }

    this.GetLastChild = function (activity = undefined){
        const children = Object.keys(this.childActivities)
            .filter((childActivity)=>(!activity || childActivity == activity)) // if Activity is undefined or matches the child activity
            .map((key)=> this.childActivities[key])
            .sort((a, b) => Math.sign(b.MaxFinish - a.MaxFinish)); // Sort Descending
        return children[0];
    }

    this.GetFirstChild = function (activity = undefined){
        const children = Object.keys(this.childActivities)
            .filter((childActivity)=>(!activity || childActivity == activity)) // if Activity is undefined or matches the child activity
            .map((key)=> this.childActivities[key])
            .sort((a, b) => Math.sign(a.MaxFinish - b.MaxFinish));
        return children[0];
    }

    this.UpdateRawData = function () {
        if (this.StartDate){
            this._workitem.fields["Microsoft.VSTS.Scheduling.StartDate"] = this.StartDate.tfsFormat();
        }else{
            this._workitem.fields["Microsoft.VSTS.Scheduling.StartDate"] = this.StartDate;
        }
        if (this.FinishDate){
            this._workitem.fields["Microsoft.VSTS.Scheduling.FinishDate"] = this.FinishDate.tfsFormat();
        }else{
            this._workitem.fields["Microsoft.VSTS.Scheduling.FinishDate"] = this.FinishDate;
        }
        this._workitem.fields["System.AssignedTo"] = this.OriginalAssignedTo;
        this._workitem.rev = -1;
    }

}