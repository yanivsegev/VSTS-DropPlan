var colWidth = 180;
var _witToSave = [];
var _witInUpdate = [];

var _today = new Date(new Date().yyyy_mm_dd());

function render(isSaving, data) {
    
    var result = "<table id='tasksTable' class='mainTable' cellpadding='0' cellspacing='0'><thead><tr>";
    result = result + "<td class='locked_class_name'><div class='taskColumn assignToColumn rowHeaderSpace'>&nbsp;</div></td>"

    for (var colIndex = 0; colIndex < sprint.Dates.length; colIndex++) {
        var date = sprint.Dates[colIndex].ConvertGMTToServerTimeZone();
        result = result + "<td class='column_class_name'><div class='taskColumn taskHeader' style='width:" + colWidth + "px'>" + 
                            VSS.Core.convertValueToDisplayString(date, "dddd") + "<br>";

        result = result + VSS.Core.convertValueToDisplayString(date, "d") + "</div></td>";            
                            
    }
    result = result + "</tr><tbody>"
 
    for (var nameIndex = 0; nameIndex < data.length; nameIndex++) {
        var personRow = data[nameIndex];

        if (personRow.hasItems){

            result = result + "<tr class='taskTr taskTrSpace'><td class='row_class_name'><div class='assignToColumn rowHeaderSpace'/></td><td colspan='" + (sprint.Dates.length) + "'/></tr>";
            result = result + "<tr class='taskTr taskTrContent' >";

            if (personRow.assignedTo) {

                result = result + "<td class='row_class_name' assignedToId=" + personRow.assignedToId + "><div class='assignToColumn rowHeader'>";
                if (personRow.avatar) {
                    result = result +  "<img class='assignedToAvatar' src='" + personRow.avatar + "'/>"
                }
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
                result = result + "<td class='row_class_name' assignedToId=" + personRow.assignedToId + "><div class='assignToColumn rowHeader'><div class='assignedToName'>Unassigned</div></div></td>";
            }

            for (var dateIndex = 0; dateIndex < sprint.Dates.length; dateIndex++) {
                var date = sprint.Dates[dateIndex].yyyymmdd();
                personDateCell = personRow[date];
                result = result + "<td class='taskTd ";
                if (personDateCell.isDayOff) result = result + "taskDayOff "
                if (date == _today.yyyymmdd()) result = result + "taskToday "

                result = result + "'>";

                for (var taskIndex = 0; taskIndex < (personDateCell.MaxDataRow || 0); taskIndex++) {
                    var task = personDateCell[taskIndex];
                    result = result + "<div class='taskDiv'>";

                    if (task.Type == 1 && task.part == 0) {
                        var parentId = null;
                        var parentWit = null;
                        var partnerWorktemId = null;
                        result = result + "<div witId=" + task.workItem.Id;
                        
                        if (task.isWitTask){
                            parentId = task.workItem.GetParentId();
                            parentWit = sprint.GetWorkitemByIdFromAll(parentId);
                            partnerWorktemId = sprint.AllWits.indexOf(parentWit);
                            result = result + " witParentId=" + parentId + " class='task tooltip ";
                        }else{
                            result = result + " class='task ";
                        }

                        if (task.endDate < _today) result = result + "taskOverDue "

                        if (isSaving && isWitInUpdate(task.workItem.Id)) result = result + "taskSaving "

                        switch (task.workItem.Blocked) {
                            case "Yes": result = result + "taskBlocked "; break;
                        }

                        switch (task.workItem.State) {
                            case "Done": result = result + "taskDone "; break;
                            case "Closed": result = result + "taskDone "; break;
                        }

                        
                        result = result + " taskStart";
                        if (!task.isWitTask){
                            result = result + " PBItaskStart";
                        }

                        result = result + " taskAreaPath" + task.areaPath.id + " ";

                        result = result + "' style='width:" + (colWidth * task.total - 26) + "px;";

                        result = result + "'>";

                        if (task.isWitTask){

                            var tooltiptextcls = 'tooltiptextPBI';
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
                                    result = result + "Open PBI";
                                }
                                result = result + "</div></div></div>";
                            }
                        }

                        result = result + "<div class='taskTitle'><span class='openWit'>" + task.workItem.Title + "</span></div>";
                        if (parentWit){
                            
                            var relatedItems = [];
                            parentWit.Relations.forEach(function(item,index) { 
                                if (item.rel == "System.LinkTypes.Hierarchy-Forward"){
                                    var seccesor = item.url.substring(item.url.lastIndexOf("/") + 1)
                                    var item2 = sprint.GetWorkitemByIdFromAll(seccesor)
                                    if (item2) {
                                        relatedItems.push(item2);
                                    }
                                }
                            });

                            relatedItems = relatedItems.sort(function (a, b) { 
                                if (a.StartDate && b.StartDate) {
                                    return a.StartDate.valueOf() - b.StartDate.valueOf();
                                } else {
                                    return a.Id - b.Id;
                                }
                              });

                            if (relatedItems.length > 1){
                                result = result + "<div class='relatedTaskBox'>";
                                
                                relatedItems.forEach(function(item,index) {

                                    result = result + "<div class='relatedTask ";

                                    if (item.FinishDate < _today) result = result + "taskOverDue ";

                                    switch (item.Blocked) {
                                        case "Yes": result = result + "taskBlocked "; break;
                                    }

                                    switch (item.State) {
                                        case "Done": result = result + "taskDone "; break;
                                        case "Closed": result = result + "taskDone "; break;
                                    }

                                    if (item.Id == task.workItem.Id) result = result + "taskCurrent ";

                                    result = result + "'>&nbsp</div>";
                                });

                                result = result + "</div>";
                            }    
                        }

                        if (task.isWitTask){
                            
                            var remain = task.workItem.RemainingWork;
                            if (remain != "") result = result + "<div class='taskRemainingWork'>" + remain + "</div>";

                        }

                        result = result + "</div>";
                    }

                    result = result + "</div>";

                }
                result = result + "</td>";
            }
            result = result + "</tr>";
        }
    }

    result = result + "</tbody></table>";
    container.innerHTML = result;
}

function ResetRelations() {
    $(".sameParent").removeClass("sameParent");

    var can1 = document.getElementById('canvas2');
    var ctx1 = can1.getContext('2d');
    can1.style.opacity = 0;
    clearRelationsInternal(ctx1, can1);
}

function DrawRelations(current) {
    var can1 = document.getElementById('canvas2');
    var ctx1 = can1.getContext('2d');
    var fillStyle = "gray";

    if (!current.find(".taskTitle").hasClass('noclick')) {
        var witParentId = current.attr("witParentId");
        if (witParentId != -1) {
            $("div[witParentId=" + witParentId + "]").each(function (x, other) {
                if (!current.is(other)) {
                    $(other).addClass("sameParent");
                    can1.style.opacity = 1;
                    drawArrow(ctx1, can1, $(current), $(other), fillStyle, false);
                }
            });
        }
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
    $(".taskStart:not(.PBItaskStart)").hover(function (In) {
        if (!$(".activeTask")[0]) {
            var current = $(In.target).closest(".taskStart");
            DrawRelations(current);
        }
    },
        function (Out) {
            if (!$(".activeTask")[0]) {
                ResetRelations();
            }
        });


    $("body").click(function () {
        ResetRelations();
        $(".activeTask").removeClass("activeTask");
    });


    $(".taskStart:not(.PBItaskStart)").click(function (event) {
        event.stopPropagation();
        ResetRelations();
        $(this).toggleClass("activeTask");
        $(".activeTask").not($(this)).removeClass("activeTask");
        if ($(this).hasClass("activeTask")) {
            DrawRelations($(this));
        }
    });

    $(window).scroll(function () {
        AlignTitlesToView();
    });

    $.fn.scrollView = function (fromTop) {
        var scroll = this;
        scroll.fromTop = fromTop;
        return this.each(function () {
          $('html, body').animate({
            scrollTop: $(this).offset().top - scroll.fromTop
          }, 1);
        });
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
        $(".openWit").click(function (event) {
                       event.stopPropagation();
        
                var witId = $(this).parent().parent().attr("witId");
        
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
            });
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
    $(".sameParent").removeClass("sameParent");
    $(obj).find(".taskTitle").addClass('noclick');
    clearRelations();
    $(obj).addClass("taskChanged");
}

function updateWorkItemDates(witId, changeStartDays, changeEndDays) {
    
    if (changeStartDays != 0 || changeEndDays != 0) {
        
        var workItem = sprint.GetWorkitemByIdFromAll(witId);
        if (workItem.StartDate) {
        
            workItem.StartDate = workItem.StartDate.addDays(changeStartDays);

            workItem.FinishDate = workItem.FinishDate.addDays(changeEndDays);

            pushWitToSave(witId);
        }
    }
}

function updateWorkItemAssignTo(witId, assignedTo) {
    var workItem = sprint.GetWorkitemByIdFromAll(witId);
    
    if (workItem.AssignedTo != assignedTo) {
        workItem.AssignedTo = assignedTo;
        pushWitToSave(witId);
    }
}

