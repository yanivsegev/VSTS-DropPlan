function Workitem(workitem, _workItemTypes, _workItemPBITypes){
    
    this._workitem = workitem;
    
    this.Init = InitFunc;

    this.Init();

    function InitFunc(){

        var workitem = this._workitem;

        this.Id = workitem.id;

        this.OriginalStartDate = workitem.fields["Microsoft.VSTS.Scheduling.StartDate"];
        this.OriginalFinishDate = workitem.fields["Microsoft.VSTS.Scheduling.FinishDate"]; 
    
        this.BacklogPriority = workitem.fields["Microsoft.VSTS.Common.BacklogPriority"];
        this.AssignedTo = workitem.fields["System.AssignedTo"] || "";
        this.AreaPath = workitem.fields["System.AreaPath"] || "";
        this.RemainingWork = workitem.fields["Microsoft.VSTS.Scheduling.RemainingWork"] || 0;

        this.Blocked = workitem.fields["Microsoft.VSTS.CMMI.Blocked"];
        this.State = workitem.fields["System.State"];
        this.Title = workitem.fields["System.Title"];
        this.WorkItemType = workitem.fields["System.WorkItemType"];

        this.Relations = workitem.relations;
        
        if (this.OriginalStartDate) this.StartDate = new Date(this.OriginalStartDate).getGMT();
        if (this.OriginalFinishDate) this.FinishDate = new Date(this.OriginalFinishDate).getGMT(); 

        this.isTaskWit = jQuery.grep( _workItemTypes , function(element){ return element.name == workitem.fields["System.WorkItemType"]; }).length > 0;
        this.isPBIWit = jQuery.grep( _workItemPBITypes , function(element){ return element.name == workitem.fields["System.WorkItemType"]; }).length > 0;
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
        this._workitem.fields["System.AssignedTo"] = this.AssignedTo;
    }

}