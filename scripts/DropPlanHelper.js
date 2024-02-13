var colWidth = 180;
var _witToSave = [];
var _witInUpdate = [];

var _today = new Date(new Date().yyyy_mm_dd());

function render(isSaving, data) {
    const activityTypeOrder=repository.getActivityOrder();
    let result = "<table id='tasksTable' class='mainTable' cellpadding='0' cellspacing='0'><thead><tr>";
    result = result + "<td class='locked_class_name'><div class='taskColumn assignToColumn rowHeaderSpace'>&nbsp;</div></td>"

    for (const element of sprint.Dates) {
        const date = element.ConvertGMTToServerTimeZone();
        result = result + "<td class='column_class_name'><div class='taskColumn taskHeader ' style='width:" + colWidth + "px;'>" + 
                            VSS.Core.convertValueToDisplayString(date, "dddd") + "<br>";

        result = result + VSS.Core.convertValueToDisplayString(date, "d") + "</div></td>";
    }
    result = result + "</tr><tbody>"

    for (const personRow of data) {
        if (personRow.hasItems || personRow.Capacity){
            var personWarnings="";

            result = result + "<tr class='taskTr taskTrSpace'><td class='row_class_name'><div class='assignToColumn rowHeaderSpace'/></td><td colspan='" + (sprint.Dates.length) + "'/></tr>";
            result = result + "<tr class='taskTr taskTrContent' >";

            if(personRow.hasEndsOnNonWorkingDay && !repository.GetUserSettings().ShowTeamNonWorkingDays){
                personWarnings = personWarnings +  "<div class='taskWarning'><div class='taskWarningIcon'>⚠</div><div class='taskWarningTooltip taskWarningAlignRight' >";
                personWarnings = personWarnings + "<p>Some tasks may not show as they are scheduled on a team non-working day!</p>"
                personWarnings = personWarnings + "</div></div>"
            }

            if (personRow.assignedTo) {

                result = result + "<td class='row_class_name' assignedToId=" + personRow.assignedToId + "><div class='assignToColumn rowHeader'>";
                if (personRow.avatar) {
                    result = result +  "<img class='assignedToAvatar' src='" + personRow.avatar + "'/>"
                }
                result = result + personWarnings;
                result = result + "<div class='assignedToName'>" + personRow.assignedTo + "</div>"

                if (personRow.TotalCapacity > 0) {
                    var cssClass = 'visual-progress-total visual-progress-overallocated';
                    var cssClassOut = 'visual-progress-current visual-progress-overallocated';
                    var precent = 0;
                    if (personRow.TatalTasks > 0){
                        precent = personRow.TotalCapacity / personRow.TatalTasks * 100;
                    }
                    if (personRow.TotalCapacity >= personRow.TatalTasks) {
                        cssClass = ' visual-progress-underallocated';
                        cssClassOut = 'visual-progress-total visual-progress-current visual-progress-total-unallocated';
                        precent = personRow.TatalTasks / personRow.TotalCapacity * 100;
                    }

                    result = result + "<div class='visual-progress-top-container'><div class='visual-progress-container'><div class='" + cssClassOut + "' style='width: 100%;'><div class='" + cssClass + "' style='width: " + precent + "%;'></div></div></div><div class='progress-text'>(" + personRow.TatalTasks + " of " + personRow.TotalCapacity + "h)</div></div></div></td>";
                }
            } else {
                result = result + "<td class='row_class_name' assignedToId=" + personRow.assignedToId + "><div class='assignToColumn rowHeader'><div class='assignedToName'>Unassigned</div>"
                result = result + personWarnings;
                result = result + "</div></td>";
            }
            var previousDate;
            for (const columnDate of sprint.Dates) {
                let date = columnDate.yyyymmdd();
                personDateCell = personRow[date];
                result = result + "<td class='taskTd ";
                if (personDateCell.isDayOff) result = result + "taskDayOff "
                if (personDateCell.isTeamDayOff) result = result + "taskTeamDayOff "
                if (date == _today.yyyymmdd()) result = result + "taskToday "
                // 86400000 is the number of seconds in a day, I'm not 100% sure if these dates are Summer time/DST safe (i.e., all in UTC)
                // so I'm padding it and multiplying by 1.5
                if (previousDate && ((columnDate - previousDate) > 129600000)) result = result + "previousDayOff "

                result = result + "' cellDate='" + columnDate.tfsFormat() + "'>";

                for (let taskIndex = 0; taskIndex < (personDateCell.MaxDataRow || 0); taskIndex++) {
                    const task = personDateCell[taskIndex];
                    result = result + "<div class='taskDiv'>";

                    if (task.Type == 1 && task.part == 0) {
                        var parentId = null;
                        var parentWit = null;
                        var partnerWorktemId = null;
                        var warnings = [];
                        result = result + "<div witId=" + task.workItem.Id;

                        const allowSimultaneousSubsequentActivities =false;
                        const useActivityTypeInDependencyTracking =false;

                        if (task.isWitTask){
                            parentId = task.workItem.GetParentId();
                            parentWit = sprint.GetWorkitemByIdFromAll(parentId);
                            result = result + " witParentId=" + parentId + " class='task tooltip ";
                            if(parentWit && sprint.PlanningIssues){
                                partnerWorktemId = sprint.AllWits.indexOf(parentWit);

                                if(task.workItem.Activity && parentWit.childActivities) {
                                    const activityIndex = activityTypeOrder.findIndex(
                                        function(activities){
                                            return activities.indexOf(task.workItem.Activity) !== -1;
                                        }
                                    );
                                    for(const activities of activityTypeOrder.slice(0,activityIndex)){
                                        for(const activity of activities){
                                            if (allowSimultaneousSubsequentActivities && parentWit.childActivities[activity] && parentWit.childActivities[activity].MinStart > task.workItem.StartDate){
                                                warnings.push(`${task.workItem.Activity} starting before ${activity} has started!`);
                                            }
                                            if (!allowSimultaneousSubsequentActivities && parentWit.childActivities[activity] && parentWit.childActivities[activity].MaxFinish > task.workItem.StartDate){
                                                warnings.push(`${task.workItem.Activity} starting before ${activity} has finished!`);
                                            }
                                            if (parentWit.childActivities[activity] && parentWit.childActivities[activity].MaxFinish > task.workItem.FinishDate){
                                                warnings.push(`${task.workItem.Activity} finishing before ${activity} has finished!`);
                                            }
                                        }
                                    }
                                    for(const activities of activityTypeOrder.slice(activityIndex+1)){
                                        for(const activity of activities){
                                            if (allowSimultaneousSubsequentActivities && parentWit.childActivities[activity] && parentWit.childActivities[activity].MinStart < task.workItem.StartDate){
                                                warnings.push(`${activity} starting before ${task.workItem.Activity} has started!`);
                                            }
                                            if (!allowSimultaneousSubsequentActivities && parentWit.childActivities[activity] && parentWit.childActivities[activity].MinStart < task.workItem.FinishDate){
                                                warnings.push(`${activity} starting before ${task.workItem.Activity} has finished!`);
                                            }
                                            if (parentWit.childActivities[activity] && parentWit.childActivities[activity].MaxFinish < task.workItem.FinishDate){
                                                warnings.push(`${activity} finishing before ${task.workItem.Activity} has finished!`);
                                            }
                                        }
                                    }
                                    if(warnings.length){
                                        result = result + " taskOutOfSequence ";
                                    }
                                }
                                
                                const predecessors = sprint.GetWorkitemsByIdsFromAll(parentWit.GetPredecessorIds());
                                for(const predecessor of predecessors){
                                    const lastChild=predecessor.GetLastChild(useActivityTypeInDependencyTracking ? task.workItem.Activity : undefined);
                                    if(lastChild && lastChild.MaxFinish > task.workItem.StartDate){
                                        warnings.push(`${useActivityTypeInDependencyTracking && task.workItem.Activity ? task.workItem.Activity : 'Task'} starting before predecessor "${predecessor.Title}" ${useActivityTypeInDependencyTracking && task.workItem.Activity ? task.workItem.Activity.toLowerCase() : ''} has finished!`);
                                    }
                                }
                                const successors = sprint.GetWorkitemsByIdsFromAll(parentWit.GetSuccessorIds());
                                for(const successor of successors){
                                    const firstChild=successor.GetFirstChild(useActivityTypeInDependencyTracking ? task.workItem.Activity : undefined);
                                    if(firstChild && firstChild.MinStart < task.workItem.FinishDate){
                                        warnings.push(`Successor "${successor.Title}" ${useActivityTypeInDependencyTracking && task.workItem.Activity ? task.workItem.Activity : ''} starting before ${useActivityTypeInDependencyTracking && task.workItem.Activity ? task.workItem.Activity.toLowerCase() : 'task'} has finished!`);
                                    }
                                }
                            }
                        }else{
                            result = result + " class='task ";
                        }

                        if (task.endDate < _today) result = result + "taskOverDue "

                        if (isSaving && isWitInUpdate(task.workItem.Id)) result = result + "taskSaving "

                        switch (task.workItem.Blocked) {
                            case "Yes": result = result + "taskBlocked "; break;
                        }

                        switch (task.workItem.State) {
                            case "Done":
                            case "Closed": result = result + "taskDone "; break;
                        }

                        result = result + " taskStart";
                        if (!task.isWitTask){
                            result = result + ` PBItaskStart TaskType${task.workItem.workItemConfig.cssName}`;
                        } else {
                            result = result + ` TaskType${task.workItem.workItemConfig.cssName}`;
                        }


                        result = result + " taskAreaPath" + task.areaPath.id + " ";
                        var contentWidth = (colWidth * task.total - 26);
                        result = result + "' style='width:" + contentWidth + "px; ";

                        if (task.isWitTask){
                            var remain = task.workItem.RemainingWork;
                            //grab the percentage, but don't let it go over 90% so that it's visually obvious that the ticket isn't complete
                            const percentComplete = Math.min(Math.floor((task.workItem.CompletedWork / task.workItem.TotalWork) *100), 90);
                            if (remain != undefined && remain != "") result = `${result}background-image: linear-gradient(90deg, color-mix(in srgb, var(--taskDone), transparent 50%) calc(${percentComplete}% + 6px), #FFFFFF00 0);`;
                        }

                        result = result + "'>";

                        if (task.isWitTask){

                            let tooltiptextcls = 'tooltiptextPBI';
                            if (parentWit) {
                                if (parentWit.WorkItemType == "Bug") {
                                    tooltiptextcls = 'tooltiptextBUG';
                                }
                            }
                            if (parentId != -1) {
                                result = result + "<div class='tooltiptext " + tooltiptextcls + "' witId=" + parentId + "><div class='taskTitle pbiText'><div class='openWit'>";
                                if (parentWit) {
                                    result = result + parentWit.Title + "</div><div class='pbiState'>" + parentWit.State;
                                } else {
                                    result = result + "Open Parent";
                                }
                                result = result + "</div></div></div>";
                            }
                        }

                        result = result + "<div class='taskTitle'><div class='taskTypeIcon'></div>"
                        if (warnings.length){
                            // style='width: min(" + (colWidth*2.5) + "px, max(" + contentWidth + "px, " + (colWidth * 1.5) + "px))'
                            result = result + "<div class='taskWarning'><div class='taskWarningIcon'>⚠</div><div class='taskWarningTooltip' >";
                            warnings.forEach(function (warning){
                                result = result + "<p>" + warning +"</p>";
                            });
                            result = result + "</div></div>"
                        }
                        
                        result = result + "<span class='openWit'>" + task.workItem.Title + "</span></div>";
                        if (parentWit){
                            let relatedItems = [];
                            parentWit.Relations.forEach(
                                function(item,index) {
                                    if (item.rel == "System.LinkTypes.Hierarchy-Forward"){
                                        const successor = item.url.substring(item.url.lastIndexOf("/") + 1)
                                        const item2 = sprint.GetWorkitemByIdFromAll(successor)
                                        if (item2) {
                                            relatedItems.push(item2);
                                        }
                                    }
                                }
                            );

                            relatedItems = relatedItems.sort(
                                function (a, b) {
                                    if (a.StartDate && b.StartDate) {
                                        return a.StartDate.valueOf() - b.StartDate.valueOf();
                                    } else {
                                        return a.Id - b.Id;
                                    }
                                }
                            );

                            if (relatedItems.length > 10){
                                //If more than 10 siblings, show a progress bar.
                                const countOfSiblingStates=relatedItems.reduce((agg, item) => {
                                    if (agg[item.State]){
                                        agg[item.State].count++;
                                    } else {
                                        agg[item.State] = {count:1, stateColor: item.stateColor}
                                    }
                                    return agg;
                                },{})

                                // Produce the style and text for the progress bar, by calculating the percentage of each state and then using that to create a gradient.
                                const siblingStyleAndText = (Object.keys(countOfSiblingStates).reduce((output, key)=>{
                                    const state=countOfSiblingStates[key];
                                    const percent=(state.count/relatedItems.length)*100;

                                    output.style.push(`#${state.stateColor} ${output.lastPercent}%`);
                                    output.style.push(`#${state.stateColor} ${(output.lastPercent+percent)}%`)
                                    output.text.push(`${state.count} ${key}`)
                                    output.lastPercent =+ percent;
                                    return output;
                                }, {style: [], text:[], lastPercent: 0}))

                                result = result + "<div class='relatedTaskBox relatedTaskPCBox' style='background: linear-gradient(90deg, ";
                                result = result + siblingStyleAndText.style.join(", ");
                                result = result + `)'>${siblingStyleAndText.text.join(", ")}</div>`;
                            } else if (relatedItems.length > 1){
                                result = result + "<div class='relatedTaskBox'>";

                                relatedItems.forEach(function(item,index) {
                                    result = result + "<div class='relatedTask ";
                                    if (item.FinishDate < _today) {
                                        result = result + "taskOverDue ";
                                    }

                                    switch (item.Blocked) {
                                        case "Yes": result = result + "taskBlocked "; break;
                                    }

                                    switch (item.State) {
                                        case "Done":
                                        case "Closed": result = result + "taskDone "; break;
                                    }

                                    if (item.Id == task.workItem.Id) result = result + "taskCurrent ";

                                    result = result + "' style='"
                                    if (!(item.FinishDate < _today)) {
                                        result = result + "background-color:#"+item.stateColor+"";
                                    }
                                    result = result + "'>&nbsp</div>";
                                });

                                result = result + "</div>";
                            }
                        }

                        if (task.isWitTask){
                            if (remain != "") result = result + "<div class='taskRemainingWork'>" + remain + "</div>";
                        }
                        result = result + "</div>";
                    }

                    result = result + "</div>";

                }
                result = result + "</td>";
                previousDate=columnDate;
            }
            result = result + "</tr>";
        }
    }

    result = result + "</tbody></table>";
    container.innerHTML = result;
    var messageBox=document.getElementById("messageBoxContainer")
    if (messageBox) messageBox.remove();
}

function ResetRelations() {
    $(".sameParent").removeClass("sameParent");

    var can1 = document.getElementById('canvas2');
    var ctx1 = can1.getContext('2d');
    can1.className = "relations";
    clearRelationsInternal(ctx1, can1);
}

function DrawRelations(current) {
    var can1 = document.getElementById('canvas2');
    var ctx1 = can1.getContext('2d');
    var fillStyle = "gray";
    var showRelations = false;
    clearRelationsInternal(ctx1, can1);

    if (!current.find(".taskTitle").hasClass('noclick')) {
        var witParentId = current.attr("witParentId");
        if (witParentId && witParentId != -1) {
            $("div[witParentId=" + witParentId + "]").each(
                function (x, other) {
                    if (!current.is(other)) {
                        $(other).addClass("sameParent");
                        showRelations = true;
                        drawArrow(ctx1, can1, $(current), $(other), fillStyle, false);
                    }
                }
            );
        } else {
            const witId = current.attr("witid");
            if (witId != -1) {
                const currentWit = sprint.GetWorkitemByIdFromAll(witId);
                const successorIds = currentWit.GetSuccessorIds();
                successorIds.forEach((id)=>{
                    showRelations = true;
                    const other=$("div[witid=" + id + "]");
                    drawArrow(ctx1, can1, $(current), $(other[0]), fillStyle, true);
                });
            }
        }
    }

    if (showRelations) {
        can1.className = "relations showRelations";
    }
}

function AlignTitlesToView() {
    $(".taskTitle").each(function (i, elm) {

        var offset = 0 - ($(elm).offset().left - 100 - $(window).scrollLeft());
        var title = $(elm).find(".openWit");
        if (offset > 0) {
            title.css("padding-left", (offset) + "px");
        } else {
            title.css("padding-left", "0px");
        }
        return true;
    })
}

function dettachEvents(){
    $(".taskStart").off();
    $("body").off();
    $(window).off();
    $(".openWit").off();
    $(".taskTrContent").off();
}

function attachEvents() {
    console.log("Attach events")
    $(".taskStart:not(.taskSaving)").hover( //:not(.PBItaskStart)
        function (In) {
            if (!$(".activeTask")[0]) {
                var current = $(In.target).closest(".taskStart");
                DrawRelations(current);
            }
        },
        function (Out) {
            if (!$(".activeTask")[0]) {
                ResetRelations();
            }
        }
    );


    $("body").click(function () {
        ResetRelations();
        $(".activeTask").removeClass("activeTask");
        $(".right-click-menu").remove();
    });


    $(".taskStart:not(.PBItaskStart)").click(
        function (event) {
            event.stopPropagation();
            $(this).toggleClass("activeTask");
            $(".activeTask").not($(this)).removeClass("activeTask");
            if ($(this).hasClass("activeTask")) {
                DrawRelations($(this));
            }
        }
    );

    $(".taskTd").on("contextmenu",
        function (event) {
            $(".right-click-menu").remove();
            if (event.target != this){
                // if clicking on a task we get the parent td, which will always be the starting td.  To stop this marking the wrong day we're just going to ignore anything where the event target doesn't match the element where we attached the event.
                return;
            }
            let menuItems = [];
            
            var member = sprint.GetAssignToNameById($(this).closest('tr')[0].cells[0].attributes["assignedtoid"].value)?.OriginalAssignedTo;
            const memberCapacity = repository._data.teamMemberCapacities.find((e)=>e.teamMember.id == member?.id);
        
            if(memberCapacity){
                const currentCell=$(this).closest('td');
                var date = new Date(currentCell[0].attributes["cellDate"].value);
                if (currentCell.hasClass("taskDayOff") && !currentCell.hasClass("taskTeamDayOff")) {
                    menuItems.push({text:'Remove Day off', onClick:()=>{
                        repository.RemoveMemberDayOff(member, date);
                        processWorkItems(sprint.RawWits, false);
                    }})
                } else if (!currentCell.hasClass("taskDayOff") && !currentCell.hasClass("taskTeamDayOff")) {
                    menuItems.push({text:'Mark as Day off', onClick:()=>{
                        repository.SetMemberDayOff(member, date);
                        processWorkItems(sprint.RawWits, false);
                    }});
                }
            }
            // want to add more right click features in future.
            return handleRightClick(event, menuItems);
        }
    );

    $(".tooltiptext").click(
        function (event) {
            event.stopPropagation();
            $(this).toggleClass("expandToolTip");
        }
    );

    $(window).scroll(function () {
        AlignTitlesToView();
    });

    $.fn.scrollView = function (fromTop) {
        var scroll = this;
        scroll.fromTop = fromTop;
        return this.each(
            function () {
                $('html, body').animate({
                    scrollTop: $(this).offset().top - scroll.fromTop
                }, 1);
            }
        );
    }

    window.fixMouseEvents = function(){
        function throttled(fn, delay) {
            let lastCall = 0;
            return function (...args) {
                const now = (new Date).getTime();
                if (now - lastCall < delay) {
                    return;
                }
                lastCall = now;
                return fn(...args);
            }
          };

        var drag_active = false;

        var original_mouseMove = jQuery.ui.mouse.prototype._mouseMove;
        jQuery.ui.mouse.prototype._mouseMove = function () {
            if (drag_active) {
                original_mouseMove.apply(this, arguments);
            }
        }

        var original_mouseDown = jQuery.ui.mouse.prototype._mouseDown;
        jQuery.ui.mouse.prototype._mouseDown = function () {
            drag_active = true;
            original_mouseDown.apply(this, arguments);
        }
        var original_mouseUp = jQuery.ui.mouse.prototype._mouseUp;
        jQuery.ui.mouse.prototype._mouseUp = function () {
            original_mouseUp.apply(this, arguments);
            drag_active = false;
        }

        jQuery.ui.mouse.prototype._mouseMove = throttled(jQuery.ui.mouse.prototype._mouseMove, 10);
    }

    window.setupOpenWit = function(){
        $(".openWit").unbind("click");
        $(".openWit").click(
            function (event) {
                event.stopPropagation();
        
                var witId = parseInt($(this).parent().parent().attr("witId"));
        
                if ($(this).parent().hasClass('noclick')) {
                    $(this).parent().removeClass('noclick');
                }
                else if(event.ctrlKey){
                    var text = $(event.target).text();
                    window.goBackElemClass = '.'+ $(event.target).attr('class').split(' ').join('.') + ':contains("'+text+'")';
					window.goBackElemClassTop = $(event.target)[0].getBoundingClientRect().top;
                    $(document).bind('keydown.escFilter', function(e) {
                        if (e.key == "Escape") {
                        $('#filterBy').val('');
                        $('#filterBy').trigger('input');
                        setTimeout(function(){ 
                             var oldLocationElement = $(window.goBackElemClass);
                              oldLocationElement.scrollView(window.goBackElemClassTop);
                             },50);
                           $(document).unbind('keydown.escFilter');
                        }
                        window.setupOpenWit();
                    });
                    
                    var cleanText  = text.replace(/\[.*?\]/,'');
                    $('#filterArea > option:nth-child(1)').prop('selected', true);
                    $('#filterBy').val(cleanText);
                    $('#filterBy').trigger('input');
                }
                else {
                    VSS.require(["TFS/WorkItemTracking/Services"], function (TFS_Wit_Services) {
                        TFS_Wit_Services.WorkItemFormNavigationService.getService().then(function (workItemNavSvc) {
                        workItemNavSvc.openWorkItem(witId);
                        });
                    });
                }
            }
        );
    };
    window.setupOpenWit();
    //window.fixMouseEvents();
 

    $(".taskStart:not(.taskSaving):not(.PBItaskStart)").draggable(({
        opacity: 0.7,
        containment: ".mainTable",
        cancel: ".taskChanged",
        start: function (event, ui) {
            SetNoClick(this);
            PauseAutoRefresh();
        },
        stop: function (event, ui) {
            var changeDays = (Math.round((ui.position.left - ui.originalPosition.left) / colWidth));
            var witId = ui.helper.attr("witId");
            updateWorkItemDates(witId, changeDays, changeDays);
            updateWorkItemInVSS();
        }
    }));

    $(".taskTrContent").droppable({
        drop: function (event, ui) {
            var assignedTo = sprint.GetAssignToNameById($(this).closest('tr')[0].cells[0].attributes["assignedtoid"].value); ;
            var witId = ui.draggable.attr("witId");
            updateWorkItemAssignTo(witId, assignedTo);
        }
    });


    $(".taskStart:not(.taskSaving):not(.PBItaskStart)").resizable({
        grid: colWidth,
        containment: ".mainTable",
        minWidth: 60,
        handles: 'e',
        cancel: ".taskChanged",
        stop: function (event, ui) {
            var witId = ui.element.attr("witId");
            var changeDays = (Math.round((ui.size.width - ui.originalSize.width) / colWidth));
            updateWorkItemDates(witId, 0, changeDays);
            updateWorkItemInVSS();
        },
        start: function (event, ui) {
            SetNoClick(this);
            PauseAutoRefresh();
        },
    });
}

function SetNoClick(obj) {
    ResetRelations();
    $(obj).find(".taskTitle").addClass('noclick');
    $(obj).addClass("taskChanged");
}

function updateWorkItemDates(witId, changeStartDays, changeEndDays) {
    if (changeStartDays != 0 || changeEndDays != 0) {
        var workItem = sprint.GetWorkitemByIdFromAll(witId);

        if (workItem.StartDate) {
            // If hiding non-working days we need to move the start end within the sprint, so find the day in the sprint
            let currentStartDate=sprint.Dates.findIndex((day)=>day.getTime()>=workItem.StartDate.getTime())
            let currentFinishDate=sprint.Dates.findIndex((day)=>day.getTime()>=workItem.FinishDate.getTime())
            if(currentFinishDate==-1){
                currentFinishDate=currentStartDate;
            }
            workItem.StartDate = sprint.Dates[currentStartDate+changeStartDays];
            workItem.FinishDate = sprint.Dates[currentFinishDate+changeEndDays];
            pushWitToSave(witId);
        }
    }
}

function updateWorkItemAssignTo(witId, assignedTo) {
    var workItem = sprint.GetWorkitemByIdFromAll(witId);
    
    if (workItem.OriginalAssignedTo?.id != assignedTo?.OriginalAssignedTo?.id) {
        workItem.SetOriginalAssignedTo(assignedTo.OriginalAssignedTo);
        pushWitToSave(witId);
    }
}

