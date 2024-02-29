/// <reference types="vss-web-extension-sdk" />

/**
 * @typedef UserSettings
 * @prop {string} DropPlanTheme
 * @prop {boolean} ShowTeamNonWorkingDays
 *
 * @typedef RepoData
 * @prop t0 {number}
 * @prop userSettings {UserSettings}
 * @prop workClient {WorkHttpClient}
 */
function VSSRepository() {

    this.reportProgress;
    this.reportFailure;
    this.failToCallVss;
    this.WorkItemsLoaded;
    // Add defaults for userSettings here.
    /**
     * @type {RepoData}
     */
    this._data = {
        t0: performance.now(),
        userSettings:{
            DropPlanTheme:'modern',
            ShowTeamNonWorkingDays: true
        },
    };
    this.LoadWorkItems = function () { OnLoadWorkItems(this) };

    this.Init = function () { _init(this); }

    function _init(_this) {

        console.log("Starting. (" + (performance.now() - _this._data.t0) + " ms.)");
        VSS.init({
            explicitNotifyLoaded: true,
            usePlatformScripts: false,
            usePlatformStyles: true,
            applyTheme: true,
        });
        console.log("Init complete. (" + (performance.now() - _this._data.t0) + " ms.)");
        VSS.ready(function () {
            RegisterThemeEvent();
            VSS.register(VSS.getContribution().id, {});
            VSS.notifyLoadSucceeded();
            console.log("VSS init. (" + (performance.now() - _this._data.t0) + " ms.)");
        });

        _startVSS(_this);
    }

    function _startVSS(_this) {
        console.log("start VSS. (" + (performance.now() - _this._data.t0) + " ms.)");
        VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient", "TFS/Work/RestClient"],

            function (VSS_Service, TFS_Wit_WebApi, TFS_Work) {
                console.log("start VSSrequire. (" + (performance.now() - _this._data.t0) + " ms.)");
                try {
                    var extVersion = VSS.getExtensionContext().version;
                    _this._data.VssContext = VSS.getWebContext();
                    
                    console.log("VSS loaded V " + extVersion + " VssSDKRestVersion:" + VSS.VssSDKRestVersion + " VssSDKVersion:" + VSS.VssSDKVersion + " user: " + _this._data.VssContext.user.uniqueName + ". (" + (performance.now() - _this._data.t0) + " ms.)");
                    _this.reportProgress("Framework loaded.");

                    if (window._trackJs && typeof trackJs != "undefined") {
                        trackJs.addMetadata("VssSDKRestVersion", VSS.VssSDKRestVersion);
                        trackJs.addMetadata("VssSDKVersion", VSS.VssSDKVersion);
                        trackJs.configure({
                            userId: _this._data.VssContext.user.uniqueName,
                            onError: function (payload, error){
                            
                                if (error?.message?.startsWith('400 : PATCH')){
                                    console.log('Ignore 400 : PATCH error', error);
                                    // ignore update errors as they are logged with the detailed error later.
                                    return false;
                                }
                                return true; // Ensure error gets sent
                            }
                        });
                    }


                    if (window.LogRocket) {
                        window.LogRocket.init('ig33h1/drop-plan');
                        LogRocket.identify(_this._data.VssContext.user.uniqueName, {
                            name: _this._data.VssContext.user.uniqueName,
                            VssSDKRestVersion: VSS.VssSDKRestVersion,
                            VssSDKVersion: VSS.VssSDKVersion,
                        });
                    }
                    
                    /** @type { "vss-web-extension-sdk":"TFS/Work/RestClient":WorkHttpClient3_1 } */
                    let workClient = TFS_Work.getClient();
                    let otherClient = TFS_Wit_WebApi.getClient();
                    _this._data.workClient = workClient;

                    var teamContext = { projectId: _this._data.VssContext.project.id, teamId: _this._data.VssContext.team.id, project: "", team: "" };
                    var configuration = VSS.getConfiguration();

                    if (configuration && configuration.iterationId){
                        var iterationId = configuration.iterationId;
                        const extensionDataReady = new Promise(function(resolve,reject){
                            VSS.getService(VSS.ServiceIds.ExtensionData).then(function (res){
                                _this._data.dataService = res;
                                // Load the user settings, theme and Non-working day visibility.
                                // If we get more of these, we should switch over to a document.
                                const userSettingsPromises=Object.keys(_this._data.userSettings).map((key)=>_this.GetValueInExtensionDataPerUser(key));
                                Promise.all(userSettingsPromises).then(()=>{
                                    _this.reportProgress("User settings loaded.");
                                    _this.LoadSettings().then(resolve);
                                }, _this._data.failToCallVss)
                            });
                        })

                        var promisesList = [
                            workClient.getTeamDaysOff(teamContext, iterationId),
                            workClient.getTeamSettings(teamContext),
                            workClient.getCapacities(teamContext, iterationId),
                            workClient.getTeamIteration(teamContext, iterationId),
                            workClient.getTeamFieldValues(teamContext),
                        ];

                        if (workClient.getBacklogConfigurations) {
                            promisesList.push(workClient.getBacklogConfigurations(teamContext));
                        }

                        extensionDataReady.then(()=>{
                            return Promise.all(promisesList).then(function (values) {

                                console.log("Team data loaded. (" + (performance.now() - _this._data.t0) + " ms.)");
                                _this.reportProgress("Team settings loaded.");
                                _this._data.daysOff = values[0];
                                _this._data.teamSettings = values[1];
                                _this._data.teamMemberCapacities = values[2];
                                _this._data.iteration = values[3];
                                _this.IterationStartDate = _this._data.iteration.attributes.startDate;
                                _this.IterationFinishDate = _this._data.iteration.attributes.finishDate;

                                _this.IterationFirstWorkingDate = new Date(_this._data.iteration.attributes.startDate);
                                while (_this.IterationFirstWorkingDate<_this.IterationFinishDate && _this.IsTeamDayOff(_this.IterationFirstWorkingDate)){
                                    _this.IterationFirstWorkingDate = _this.IterationFirstWorkingDate.addDays(1);
                                }
                                _this.IterationLastWorkingDate = new Date(_this._data.iteration.attributes.finishDate);
                                while (_this.IterationFinishDate > _this.IterationFirstWorkingDate && _this.IsTeamDayOff(_this.IterationLastWorkingDate)){
                                    _this.IterationLastWorkingDate = _this.IterationLastWorkingDate.addDays(-1);
                                }

                                _this._data.teamValues = values[4];
                                if (values.length > 5) {
                                    _this._data.backlogConfigurations = values[5];
                                    if (!_this._data.settings.usePBILevelForTasks){
                                        _this.WorkItemTypes = _this._data.backlogConfigurations.taskBacklog.workItemTypes;
                                        _this.WorkItemPBITypes = _this._data.backlogConfigurations.requirementBacklog.workItemTypes;
                                    } else {
                                        _this.WorkItemTypes = _this._data.backlogConfigurations.requirementBacklog.workItemTypes;
                                        _this.WorkItemPBITypes = _this._data.backlogConfigurations.portfolioBacklogs.map((PBIType)=>PBIType.workItemTypes).flat();
                                    }
                                } else {
                                    _this.WorkItemTypes = [{ name: "Task" }];
                                    _this.WorkItemPBITypes = [{ name: 'Product Backlog Item' }, { name: 'Bug' }];
                                }
                                const taskConfigPromises = _this.WorkItemTypes.map(
                                    function (itemType) {
                                        return otherClient.getWorkItemType(teamContext.projectId, itemType.name);
                                    }
                                );
                                Promise.all(taskConfigPromises).then(function(taskTypeConfigs){
                                    taskTypeConfigs.forEach(function(taskTypeConfig, index, arr) {
                                        const cssName=toCssName(_this.WorkItemTypes[index].name);
                                        _this.WorkItemTypes[index].states=taskTypeConfig.states.map((state)=>({...state, cssName: toCssName(state.name)}));
                                        _this.WorkItemTypes[index].iconUrl=taskTypeConfig.icon?.url;
                                        _this.WorkItemTypes[index].color=taskTypeConfig.color;
                                        _this.WorkItemTypes[index].cssName=cssName
                                        SetWorkItemTypeCss(_this.WorkItemTypes[index]);
                                        SetCssVariable(`${cssName}IconUrl`, taskTypeConfig.icon?.url);
                                        SetCssVariable(`${cssName}IconColor`, taskTypeConfig.color);
                                    });
                                }).catch((error) => {
                                    console.error(error, "on taskConfigPromises");
                                });
                                const pbiConfigPromises = _this.WorkItemPBITypes.map(
                                    function (itemType) {
                                        return otherClient.getWorkItemType(teamContext.projectId, itemType.name);
                                    }
                                );
                                Promise.all(pbiConfigPromises).then(function(pbiTypeConfigs){
                                    pbiTypeConfigs.forEach(function(pbiTypeConfig, index, arr) {
                                        const cssName=toCssName(_this.WorkItemPBITypes[index].name);
                                        _this.WorkItemPBITypes[index].states=pbiTypeConfig.states
                                        _this.WorkItemPBITypes[index].iconUrl=pbiTypeConfig.icon?.url
                                        _this.WorkItemPBITypes[index].color=pbiTypeConfig.color
                                        _this.WorkItemPBITypes[index].cssName=cssName
                                        SetWorkItemTypeCss(_this.WorkItemPBITypes[index]);
                                        SetCssVariable(`${cssName}IconUrl`, pbiTypeConfig.icon?.url);
                                        SetCssVariable(`${cssName}IconColor`, pbiTypeConfig.color);
                                    });
                                }).catch((error) => {
                                    console.error(error, "on pbiConfigPromises");
                                });
                                VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient"],
                                    function (VSS_Service, TFS_Wit_WebApi) {

                                        _this._data.WitClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);

                                        OnLoadWorkItems(_this);
                                    }
                                );
                            }, _this._data.failToCallVss)
                        }, _this._data.failToCallVss);
                    }
                    else
                    {
                        _this.reportFailure("Failed to load iteration data");
                    }
                }
                catch (e) {
                    var msg = 'Unknown error occurred.';
                    alertUser(msg, e)
                    _this.reportFailure(msg);
                }
            });
    }

    function OnLoadWorkItems(_this) {

        var currentIterationPath = _this._data.iteration.path;

        // Query object containing the WIQL query
        var query = {
            query: "SELECT [System.Id] FROM WorkItem WHERE ([System.WorkItemType] IN GROUP 'Microsoft.TaskCategory' OR [System.WorkItemType] IN GROUP 'Microsoft.BugCategory' OR [System.WorkItemType] IN GROUP 'Microsoft.RequirementCategory') AND [System.State] NOT IN ('Removed') AND [System.IterationPath] UNDER '" + currentIterationPath.replace("'", "''") + "' "
        };
        if (_this._data.teamValues.values.length > 0) {
            query.query = query.query + " AND (";
            $.each(_this._data.teamValues.values, function (index, item) {
                if (index > 0) {
                    query.query = query.query + " OR ";
                }
                query.query = query.query + "[" + _this._data.teamValues.field.referenceName.replace("'", "''") + "] ";
                if (item.includeChildren == true) {
                    query.query = query.query + "UNDER";
                }
                else {
                    query.query = query.query + "=";
                }

                query.query = query.query + " '" + item.value.replace("'", "''") + "'";
            });

            query.query = query.query + " )";
        }


        // Executes the WIQL query against the active project
        _this._data.WitClient.queryByWiql(query, _this._data.VssContext.project.id).then(
            function (result) {

                console.log("Iteration data loaded. (" + (performance.now() - _this._data.t0) + " ms.)");
                _this.reportProgress("Work items list loaded.");
                // Generate an array of all open work item ID's
                var openWorkItems = result.workItems.map(function (wi) { return wi.id });

                if (openWorkItems.length == 0) {
                    _this.reportFailure("No work items found.");
                }
                else if (!_this._data.iteration.attributes.startDate || !_this._data.iteration.attributes.finishDate) {
                    _this.reportFailure("Please set iteration dates.");
                }
                else {
                    var start = 0;
                    var end = 0;
                    var getWorkItemsPromises = [];
                    while (end < openWorkItems.length) {
                        end = start + 200;
                        getWorkItemsPromises.push(_this._data.WitClient.getWorkItems(openWorkItems.slice(start, end), undefined, undefined, 1));
                        start = end;
                    }
                    Promise.all(getWorkItemsPromises).then(function (x) { processAllWorkItems(x, _this); }, _this.failToCallVss);
                }

            }, _this.failToCallVss);

    }

    function processAllWorkItems(values, _this) {

        _this.reportProgress("Work items details loaded.");

        var merged = jQuery.grep([].concat.apply([], values), function (elm, i) { return elm.id > 0; });
        var tasks = jQuery.grep(merged, function (elm, i) { return jQuery.grep(_this.WorkItemTypes, function (element) { return element.name == elm.fields["System.WorkItemType"]; }).length > 0; });
        merged = merged.sort(function (a, b) { return a.id - b.id});

        if (tasks.length == 0) {
            const taskTypeNames=_this.WorkItemTypes.map((item)=>item.name).join(', ').replace(/, ([^,]*)$/, ', or $1');
            _this.reportFailure(`No work items of type ${taskTypeNames} found.`);
        } else {
            _this.WorkItemsLoaded(merged);
        }
    }

    SetCssVariable = function(variableName, value){
        if(!this.SetCssVariable.rootStyles){
            this.SetCssVariable.rootStyles = document.querySelector(':root');
        }
        this.SetCssVariable.rootStyles.style.setProperty(`--${variableName}`, value);
    }

    SetWorkItemTypeCss = function(WorkItem){
        const styleSheets = document.styleSheets;

        for (let i = 0; i < styleSheets.length; i++) {
            const styleSheet = styleSheets[i];
            if (styleSheet.href?.includes("dropPlan.css")){
                styleSheet.insertRule(`.taskDiv > .TaskType${WorkItem.cssName}:before {background:#${WorkItem.color};}`);
                styleSheet.insertRule(`.taskDiv > .TaskType${WorkItem.cssName} .taskTypeIcon {background-image:url(${WorkItem.iconUrl};}`);
                WorkItem.states.forEach((state)=>{
                    styleSheet.insertRule(`.showStatus .Task${WorkItem.cssName}Status${state.cssName} {background:#${state.color};}`);
                });
                return;
            }
        }
    }

    this.GetCapacity = function (member) {
        var result = 0;
        const teamMember = this._data.teamMemberCapacities.find((e) => e.teamMember.id == member?.id);
        if (teamMember?.activities?.length > 0 ){
            result = teamMember.activities.reduce(
                function (runningTotal, current){
                    return runningTotal + current.capacityPerDay;
                }, 0
            ) || 0;
        }

        return result;
    }

    this.GetMembersWithCapacity = function(){
        return this._data.teamMemberCapacities.map((member)=>({...member.teamMember, name: member.teamMember.displayName.split("<")[0].trim()}));
    }

    this.IsDayOff = function (member, date, day) {
        var dayOff = false;
        const teamMember = this._data.teamMemberCapacities.find((e) => e.teamMember.id == member?.id)
        if (teamMember && isDayInRange(teamMember.daysOff, date)) dayOff = true;
        if (isDayInRange(this._data.daysOff.daysOff, date)) dayOff = true;
        if ($.inArray(day, this._data.teamSettings.workingDays) == -1) dayOff = true;
        return dayOff;
    }

    this.IsTeamDayOff = (dateToCheck) => {
        const gmtDateToCheck=dateToCheck.getGMT(), date=gmtDateToCheck.yyyymmdd(), day=gmtDateToCheck.getDay()

        if (isDayInRange(this._data.daysOff.daysOff, date)) return true;

        if ($.inArray(day, this._data.teamSettings.workingDays) == -1) return true;

        return false;
    }

    this.IncludeDayOnPlan = (dateToCheck) => {
        if (this._data.userSettings.ShowTeamNonWorkingDays){
            return true;
        }
        return !this.IsTeamDayOff(dateToCheck);
    }

    this.GetMemberImage = function (member) {
        return member?.imageUrl || "";
    }


    this.UpdateWorkItem = function(wijson, Id){
        return this._data.WitClient.updateWorkItem(wijson, Id);
    }

    this.SetValueInExtensionDataPerUser = function(key, value){
        // save the value to devops then update our value, also return the promise so that we can initiate a reload once saved.
        return this._data.dataService.setValue(key, value, {scopeType: "User"}).then(()=>{
            this._data.userSettings[key]=value;
        });
    }

    this.getActivityOrder = function(){
        return this._data.settings.activityOrder;
    }

    this.GetValueInExtensionDataPerUser = function (key) {
        const _data=this._data;
        return this._data.dataService.getValue(key, {scopeType: "User"}).then(function(storedValue) {
            // this picks up the stored value, or uses the existing (which will be the default value the first time loaded)
            storedValue = storedValue ?? _data.userSettings[key];
            // this feels like it's in the wrong place, shouldn't be updating the UI from in the Repo.
            if(key=='DropPlanTheme'){
                // Attempt to set the value, but if it's not in the list revert to "modern"
                if(storedValue !== $("#themes").val(storedValue).val()){
                    storedValue="modern";
                    $("#themes").val(storedValue);
                };
                changeTheme(storedValue, false);
            } else if (key=='ShowTeamNonWorkingDays'){
                $('#showNonWorkingTeamDays').prop('checked', storedValue);
            }
            if(storedValue!==undefined){
                _data.userSettings[key]=storedValue;
            }
        });
    }

    this.GetObjectFromVSS = function (key, id, defaultObj) {
        return this._data.dataService.getDocument(key, id).then(function(doc) {
            return doc;
        },function(){
            return defaultObj;
        });
    }

    this.LoadSettings = function(){
        return this.GetObjectFromVSS(`Settings.${this._data.VssContext.project.id}`, "version 1", {}).then((settings)=>{
            this.reportProgress("Extension settings loaded.");
            this._data.settings={
                    highlightPlanningIssues: true,
                    usePBILevelForTasks: false,
                    allowSimultaneousSubsequentActivities: true,
                    useActivityTypeInDependencyTracking: false,
                    activityOrder: [
                        ["Requirements"],
                        ["Design"],
                        ["Development","Test Script"],
                        //["Documentation"], Can happen anytime
                        ["Testing"],
                        ["Deployment"]
                    ]
                , ...settings}
        })
    }

    this.GetSettings = function(){
        return this._data.settings;
    }

    this.GetUserSettings = function(){
        return this._data.userSettings;
    }

    this.SetMemberDayOff = function(member, date){
        const teamContext = { projectId: this._data.VssContext.project.id, teamId: this._data.VssContext.team.id, project: "", team: "" };
        let memberCapacity = this._data.teamMemberCapacities.find((e) => e.teamMember.id == member?.id);
        if (!memberCapacity){
            memberCapacity = {teamMember: member, daysOff:[]};
            this._data.teamMemberCapacities.push(memberCapacity);
        }
        memberCapacity.daysOff.push({start: date, end: date});

        return this._data.workClient.updateCapacity(memberCapacity, teamContext, this._data.iteration.id, member.id);
    }

    this.RemoveMemberDayOff = function(member, date){
        const teamContext = { projectId: this._data.VssContext.project.id, teamId: this._data.VssContext.team.id, project: "", team: "" };
        const memberCapacity = this._data.teamMemberCapacities.find((e) => e.teamMember.id == member?.id);

        const dateTime = date.getTime();
        let daysOffRange = memberCapacity.daysOff.find((daysOffRange)=>daysOffRange.start <= date && date <= daysOffRange.end);
        const startTime= daysOffRange.start.getTime(), endTime= daysOffRange.end.getTime();

        if (startTime == dateTime && endTime == dateTime) {
            // if it's the only day off, remove the whole range.
            memberCapacity.daysOff = memberCapacity.daysOff.filter((daysOffRange)=>daysOffRange.start.getTime() != dateTime);
        }else if(startTime == dateTime){
            daysOffRange.start = date.addDays(1);
        } else if(endTime == dateTime){
            daysOffRange.end = date.addDays(-1);
        } else {
            // in the middle of a range, split it into two.
            memberCapacity.daysOff.push({start: date.addDays(1), end: daysOffRange.end});
            daysOffRange.end = date.addDays(-1);
        }

        return this._data.workClient.updateCapacity(memberCapacity, teamContext, this._data.iteration.id, member.id);
    }


    function RegisterThemeEvent(themeChanged){
        XDM.globalObjectRegistry.register("DevOps.SdkClient", function () {
            return {
                dispatchEvent: function (eventName, data) {
                    window.dispatchEvent(new CustomEvent(eventName, data));
                }
            };
        });

        window.addEventListener("themeChanged", (event) => {
            const themeEventObject = event;
            const newTheme = themeEventObject.detail;
            const isDark = (newTheme && newTheme.isDark) || false;
            newTheme.isDark = isDark;

            if (themeChanged) {
                themeChanged(newTheme);
            }

            VSS.applyTheme(newTheme.data);
        });

    }
}
