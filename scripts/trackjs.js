(function(){
window._trackJs = {
    token: "fc6fa20e86714ea3b7ee9cb34cee66d2",
    version: "#{TrackJSExtVer}",
    /*network: { error: false },*/
    onError: function (payload, error){                                
        if (error?.message?.startsWith('400 : PATCH')){
            console.log('Ignore 400 : PATCH error', error);
            // ignore update errors as they are logged with the detailed error later.
            return false;
        }
        return true; // Ensure error gets sent
    }
};
})();