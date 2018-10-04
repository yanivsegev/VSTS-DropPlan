function VSSRepository() {

    this.reportProgress;
    this.reportFailure;
    this.failToCallVss;
    this.WorkItemsLoaded;
    this._data = { t0: performance.now() };
    this.LoadWorkItems = function () { OnLoadWorkItems(this) };

    this.Init = function () { _init(this); }

    function _init(_this) {

        console.log("Stating. (" + (performance.now() - _this._data.t0) + " ms.)");

        VSS.init({
            explicitNotifyLoaded: true,
            usePlatformScripts: false,
            usePlatformStyles: true
        });

        VSS.ready(function () {
            VSS.register(VSS.getContribution().id, {});
            VSS.notifyLoadSucceeded();
            console.log("VSS init. (" + (performance.now() - _this._data.t0) + " ms.)");
        });

        _startVSS(_this);
        
        
    }

    function _startVSS(_this) {

        VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient", "TFS/Work/RestClient"],

            function (VSS_Service, TFS_Wit_WebApi, TFS_Work) {
                try {
                    var extVersion = VSS.getExtensionContext().version;
                    _this._data.VssContext = VSS.getWebContext();
                    
                    console.log("VSS loaded V " + extVersion + " VssSDKRestVersion:" + VSS.VssSDKRestVersion + " VssSDKVersion:" + VSS.VssSDKVersion + " user: " + _this._data.VssContext.user.uniqueName + ". (" + (performance.now() - _this._data.t0) + " ms.)");
                    _this.reportProgress("Framework loaded.");

                    if (window._trackJs && typeof trackJs != "undefined") {

                        trackJs.configure({ version: extVersion, userId: _this._data.VssContext.user.uniqueName });
                        trackJs.addMetadata("VssSDKRestVersion", VSS.VssSDKRestVersion);
                        trackJs.addMetadata("VssSDKVersion", VSS.VssSDKVersion);
                    }

                    var workClient = TFS_Work.getClient();
                    var teamContext = { projectId: _this._data.VssContext.project.id, teamId: _this._data.VssContext.team.id, project: "", team: "" };
                    var configuration = VSS.getConfiguration();
                    console.log("getConfiguration: " + JSON.stringify(configuration));
                    
                    if (configuration && configuration.iterationId){
                        var iterationId = configuration.iterationId;

                        VSS.getService(VSS.ServiceIds.ExtensionData).then(function (res){
                            _this._data.dataService = res;
                            loadThemes();
                        });

                        var promisesList = [
                            workClient.getTeamDaysOff(teamContext, iterationId),
                            workClient.getTeamSettings(teamContext),
                            workClient.getCapacities(teamContext, iterationId),
                            workClient.getTeamIteration(teamContext, iterationId),
                            workClient.getTeamFieldValues(teamContext)
                        ];

                        if (workClient.getBacklogConfigurations) {
                            promisesList.push(workClient.getBacklogConfigurations(teamContext));
                        }

                        var serverAnswer = Promise.all(promisesList).then(function (values) {

                            console.log("Team data loaded. (" + (performance.now() - _this._data.t0) + " ms.)");
                            _this.reportProgress("Team settings loaded.");
                            _this._data.daysOff = values[0];
                            _this._data.teamSettings = values[1];
                            _this._data.teamMemberCapacities = values[2];
                            _this._data.iteration = values[3];
                            _this.IterationStartDate = _this._data.iteration.attributes.startDate;
                            _this.IterationFinishDate = _this._data.iteration.attributes.finishDate;

                            _this._data.teamValues = values[4];
                            if (values.length > 5) {
                                _this._data.backlogConfigurations = values[5];
                                _this.WorkItemTypes = _this._data.backlogConfigurations.taskBacklog.workItemTypes;
                                _this.WorkItemPBITypes = _this._data.backlogConfigurations.requirementBacklog.workItemTypes;
                            } else {
                                _this.WorkItemTypes = [{ name: "Task" }];
                                _this.WorkItemPBITypes = [{ name: 'Product Backlog Item' }, { name: 'Bug' }];
                            }
                            VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient"],

                                function (VSS_Service, TFS_Wit_WebApi) {

                                    _this._data.WitClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);

                                    OnLoadWorkItems(_this);
                                });


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
            _this.reportFailure("No work items of type 'Task' found.");
        }
        else {
            _this.WorkItemsLoaded(merged);
        }

    }

    this.GetCapacity = function (name) {
        var result = 0;
        $.each(this._data.teamMemberCapacities, function (index, value) {
            if (value.teamMember.displayName.split("<")[0].trim() == name) {
                if (value.activities.length > 0 && value.activities[0].capacityPerDay > 0) {
                    result = value.activities[0].capacityPerDay || 6;
                }
            }
        });
        return result;
    }

    this.IsDayOff = function (name, date, day) {
        var dayOff = false;
        $.each(this._data.teamMemberCapacities, function (index, value) {
            if (value.teamMember.displayName.split("<")[0].trim() == name) {
                if (isDayInRange(value.daysOff, date)) dayOff = true;
            }
        });

        if (isDayInRange(this._data.daysOff.daysOff, date)) dayOff = true;

        if ($.inArray(day, this._data.teamSettings.workingDays) == -1) dayOff = true;

        return dayOff;
    }

    this.GetMemberImage = function (name) {
        var img = "";
        $.each(this._data.teamMemberCapacities, function (index, value) {
            if (value.teamMember.displayName.split("<")[0].trim() == name) img = value.teamMember.imageUrl;
        });
        return img;
    }


    this.UpdateWorkItem = function(wijson, Id){
        return this._data.WitClient.updateWorkItem(wijson, Id);
    }

    this.SetValueInExtensionDataPerUser = function(key, value){
        this._data.dataService.setValue(key, value, {scopeType: "User"});
    }
    
    this.GetValueInExtensionDataPerUser = function(key){
        var res;
        this._data.dataService.getValue(key, {scopeType: "User"}).then(function(c) {
            if (c && c != "") {
                $("#themes").val(c);
                changeTheme(c, false);
            }
        });
        return res;
    }
}