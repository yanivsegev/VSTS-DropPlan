// @ts-check
/// <reference types="vss-web-extension-sdk" />

/**
 * @typedef {import("TFS/WorkItemTracking/RestClient")} WITRestClient
 * @typedef {import("TFS/Work/RestClient")} WorkRestClient
 * @typedef {import("VSS/Service")} VSSService
 * @typedef{import("TFS/WorkItemTracking/Contracts")} WITContracts
 */

function VSSSettingsRepository() {

    this.reportProgress = undefined;
    this.reportFailure = undefined;
    this.failToCallVss = undefined;
    this.WorkItemsLoaded = undefined;
    //this._ready = undefined;
    //this._fail = undefined;
    this.ready = new Promise((resolve, reject)=>{
        this._ready = resolve;
        this._fail = reject;
    });
    this._data = { t0: performance.now() };

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
            console.log("VSS init. (" + (performance.now() - _this._data.t0) + " ms.)");
            RegisterThemeEvent();
            VSS.register(VSS.getContribution().id, {});
            VSS.notifyLoadSucceeded();
        });

        _startVSS(_this);
    }

    function _startVSS(_this) {
        console.log("start VSS. (" + (performance.now() - _this._data.t0) + " ms.)");
        VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient", "TFS/Work/RestClient", "TFS/WorkItemTracking/Contracts"],

            function (/** @type VSSService */ VSS_Service, /** @type WITRestClient */ TFS_Wit_WebApi, /** @type  WorkRestClient */ TFS_Work, /** @type WITContracts */ TFS_Wit_Contracts) {
                console.log("start Settings VSSrequire. (" + (performance.now() - _this._data.t0) + " ms.)");
                try {
                    var extVersion = VSS.getExtensionContext().version;
                    _this._data.VssContext = VSS.getWebContext();
                    
                    console.log("VSS loaded V " + extVersion + " VssSDKRestVersion:" + VSS.VssSDKRestVersion + " VssSDKVersion:" + VSS.VssSDKVersion + " user: " + _this._data.VssContext.user.uniqueName + ". (" + (performance.now() - _this._data.t0) + " ms.)");
                    _this.reportProgress("Framework loaded.");


                    let workClient = TFS_Work.getClient();
                    let otherClient = TFS_Wit_WebApi.getClient();

                    var teamContext = { projectId: _this._data.VssContext.project.id, teamId: _this._data.VssContext.team.id, project: "", team: "" };
                    console.log("Team context ", teamContext);
                    const extensionDataReady = /** @type {Promise<void>} */(new Promise(function(resolve,reject){
                        VSS.getService(VSS.ServiceIds.ExtensionData).then(function (res){
                            _this._data.dataService = res;
                            resolve();
                        });
                    }));

                    /** @type {(Promise<void>|IPromise<import("TFS/Work/Contracts").BacklogConfiguration>)[]} */
                    var promisesList = [
                        extensionDataReady,
                    ];

                    if (workClient.getBacklogConfigurations) {
                        promisesList.push(workClient.getBacklogConfigurations(teamContext));
                    }

                    var serverAnswer = Promise.all(promisesList).then(function (values) {

                        console.log("Team data loaded. (" + (performance.now() - _this._data.t0) + " ms.)");
                        _this.reportProgress("Team settings loaded.");
                        if (values.length > 1) {
                            /** @type {import("TFS/Work/Contracts").BacklogConfiguration} */
                            _this._data.backlogConfigurations = values[1];
                            _this.WorkItemTypes = _this._data.backlogConfigurations.taskBacklog.workItemTypes;
                            _this.WorkItemPBITypes = _this._data.backlogConfigurations.requirementBacklog.workItemTypes;
                        } else {
                            _this.WorkItemTypes = [{ name: "Task" }];
                            _this.WorkItemPBITypes = [{ name: 'Product Backlog Item' }, { name: 'Bug' }];
                        }

                        const tasksActivityPromises = _this.WorkItemTypes.map(
                            function (/** @type {{ name: string; }} */ itemType) {
                                return otherClient.getWorkItemTypeFieldWithReferences(teamContext.projectId, itemType.name, "Microsoft.VSTS.Common.Activity", TFS_Wit_Contracts.WorkItemTypeFieldsExpandLevel.All);
                            }
                        );
                        _this._data.activityAllowedValues = [];
                        Promise.allSettled([
                            Promise.all(tasksActivityPromises).then(function(taskActivityAllowedValues){
                                taskActivityAllowedValues.forEach(function(taskTypeState, index, arr) {
                                    if (_this._data.activityAllowedValues.length < 0){
                                        _this._data.activityAllowedValues=taskTypeState.allowedValues;
                                    } else {
                                        taskTypeState.allowedValues.forEach((allowedValue) =>{
                                            if(!_this._data.activityAllowedValues.includes(allowedValue)){
                                                _this._data.activityAllowedValues.push(allowedValue);
                                            }
                                        })
                                    }
                                })
                                console.log(_this._data.activityAllowedValues)
                            }).catch((error) => {
                                console.error(error, "on tasksActivityPromises");
                            }),
                            _this.LoadSettings()
                        ]).then(()=>_this._ready()).catch((error) => {
                            console.error(error, "on tasksActivityPromises and ready");
                        });;

                        VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient"],
                            function (VSS_Service, TFS_Wit_WebApi) {
                                _this._data.WitClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);
                            });


                    }, _this._data.failToCallVss);
                }
                catch (e) {
                    var msg = 'Unknown error occurred.';
                    alertUser(msg, e)
                    _this.reportFailure(msg);
                }
            });
    }

    this.SetValueInExtensionDataPerUser = function(key, value){
        this._data.dataService.setValue(key, value, {scopeType: "User"});
    }

    this.getActivityOrder = function(){
        return this._data.settings.activityOrder;
    }

    this.SetActivityOrder = function(newOrder) {
        this._data.settings.activityOrder = newOrder;
        this.SaveSettings()
    }

    this.getActivities = function() {
        return this._data.settings.activityAllowedValues;
    }

    this.getUnorderedActivities = function() {
        const flatActivityOrder=this._data.settings.activityOrder.flat();
        return this._data.activityAllowedValues.filter((activity)=>!flatActivityOrder.includes(activity)).map((activity)=> [activity]);
    }

    Object.defineProperty(this, 'highlightPlanningIssues', {
        get: function() {
            return this._data.settings.highlightPlanningIssues;
        },
        set: function(highlightPlanningIssues) {
            this._data.settings.highlightPlanningIssues = highlightPlanningIssues;
            this.SaveSettings();
        }
    });

    Object.defineProperty(this, 'usePBILevelForTasks', {
        get: function() {
            return this._data.settings.usePBILevelForTasks;
        },
        set: function(usePBILevelForTasks) {
            this._data.settings.usePBILevelForTasks = usePBILevelForTasks;
            this.SaveSettings();
        }
    });

    Object.defineProperty(this, 'allowSimultaneousSubsequentActivities', {
        get: function() {
            return this._data.settings.allowSimultaneousSubsequentActivities;
        },
        set: function(allowSimultaneousSubsequentActivities) {
            this._data.settings.allowSimultaneousSubsequentActivities = allowSimultaneousSubsequentActivities;
            this.SaveSettings();
        }
    });

    Object.defineProperty(this, 'useActivityTypeInDependencyTracking', {
        get: function() {
            return this._data.settings.useActivityTypeInDependencyTracking;
        },
        set: function(useActivityTypeInDependencyTracking) {
            this._data.settings.useActivityTypeInDependencyTracking = useActivityTypeInDependencyTracking;
            this.SaveSettings();
        }
    });

    this.GetValueInExtensionDataPerUser = function(key){
        this._data.dataService.getValue(key, {scopeType: "User"}).then(function(c) {
            c=c || "modern";
            // Attempt to set the value, but if it's not in the list revert to "modern"
            if(c !== $("#themes").val(c).val()){
                c="modern";
                $("#themes").val(c);
            };
        });
    }

    this.GetObjectFromVSS = function (key, id, defaultObj) {
        return this._data.dataService.getDocument(key, id).then(function(doc) {
            return doc;
        },function(){
            return defaultObj;
        });
    }

    this.SetObjectFromVSS = function (key, obj, id) {
        const doc ={id, ...obj}
        this._data.dataService.setDocument(key, doc).then((response)=>{
            obj.__etag=response.__etag;
        });
    }

    this.SaveSettings = function(){
        this.SetObjectFromVSS(`Settings.${this._data.VssContext.project.id}`, this._data.settings, "version 1");
    }

    this.LoadSettings = function(){
        return this.GetObjectFromVSS(`Settings.${this._data.VssContext.project.id}`, "version 1", {}).then((settings)=>{
            console.log(settings);
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
            console.log(this._data.settings);
        })
    }

    function RegisterThemeEvent(themeChanged){
        XDM.globalObjectRegistry.register("DevOps.SdkClient", function () {
            return {
                dispatchEvent: function (/** @type {string} */ eventName, /** @type {CustomEventInit<any> | undefined} */ data) {
                    window.dispatchEvent(new CustomEvent(eventName, data));
                }
            };
        });

        window.addEventListener("themeChanged", (/** @type {CustomEventInit<any>} */ event) => {
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
