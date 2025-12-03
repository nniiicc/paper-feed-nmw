var f=(i=>(i.GH_STORE="gh-store",i.STORED_OBJECT="stored-object",i.DEPRECATED="deprecated-object",i.UID_PREFIX="UID:",i.ALIAS_TO_PREFIX="ALIAS-TO:",i))(f||{});var m=class{constructor(e={}){this.cache=new Map,this.maxSize=e.maxSize??1e3,this.ttl=e.ttl??1e3*60*60,this.accessOrder=[];}get(e){let t=this.cache.get(e);if(t){if(Date.now()-t.lastAccessed>this.ttl){this.cache.delete(e),this.removeFromAccessOrder(e);return}return t.lastAccessed=Date.now(),this.updateAccessOrder(e),t.issueNumber}}set(e,t,r){if(this.cache.size>=this.maxSize&&!this.cache.has(e)){let s=this.accessOrder[this.accessOrder.length-1];s&&(this.cache.delete(s),this.removeFromAccessOrder(s));}this.cache.set(e,{issueNumber:t,lastAccessed:Date.now(),createdAt:r.createdAt,updatedAt:r.updatedAt}),this.updateAccessOrder(e);}remove(e){this.cache.delete(e),this.removeFromAccessOrder(e);}clear(){this.cache.clear(),this.accessOrder=[];}getStats(){return {size:this.cache.size,maxSize:this.maxSize,ttl:this.ttl}}shouldRefresh(e,t){let r=this.cache.get(e);return r?t>r.updatedAt:!0}updateAccessOrder(e){this.removeFromAccessOrder(e),this.accessOrder.unshift(e);}removeFromAccessOrder(e){let t=this.accessOrder.indexOf(e);t>-1&&this.accessOrder.splice(t,1);}};var y="0.11.1";var d=class{constructor(e,t,r={}){if(this.token=e,this.repo=t,!this.repo)throw new Error("Repository is required");this.config={baseLabel:r.baseLabel??"stored-object",uidPrefix:r.uidPrefix??"UID:",reactions:{processed:r.reactions?.processed??"+1",initialState:r.reactions?.initialState??"rocket"}},this.cache=new m(r.cache);}isPublic(){return this.token===null}async fetchFromGitHub(e,t={}){let r=new URL(`https://api.github.com/repos/${this.repo}${e}`);t.params&&(Object.entries(t.params).forEach(([a,n])=>{r.searchParams.append(a,n);}),delete t.params);let s={Accept:"application/vnd.github.v3+json"};if(t.headers){let a=t.headers;Object.keys(a).forEach(n=>{s[n]=a[n];});}this.token&&(s.Authorization=`token ${this.token}`);let i=await fetch(r.toString(),{...t,headers:s});if(!i.ok)throw new Error(`GitHub API error: ${i.status}`);return i.json()}createCommentPayload(e,t,r){let s={_data:e,_meta:{client_version:y,timestamp:new Date().toISOString(),update_mode:"append",issue_number:t}};return r&&(s.type=r),s}async getObject(e){let t=this.cache.get(e),r;if(t)try{r=await this.fetchFromGitHub(`/issues/${t}`),this._verifyIssueLabels(r,e)||(this.cache.remove(e),r=void 0);}catch{this.cache.remove(e);}if(!r){let c=await this.fetchFromGitHub("/issues",{method:"GET",params:{labels:["gh-store",this.config.baseLabel,`${this.config.uidPrefix}${e}`].join(","),state:"closed"}});if(!c||c.length===0)throw new Error(`No object found with ID: ${e}`);r=c[0];}if(!r?.body)throw new Error(`Invalid issue data received for ID: ${e}`);let s=JSON.parse(r.body),i=new Date(r.created_at),a=new Date(r.updated_at);return this.cache.set(e,r.number,{createdAt:i,updatedAt:a}),{meta:{objectId:e,label:`${this.config.uidPrefix}${e}`,issueNumber:r.number,createdAt:i,updatedAt:a,version:await this._getVersion(r.number)},data:s}}async createObject(e,t,r=[]){if(!this.token)throw new Error("Authentication required for creating objects");let s=`${this.config.uidPrefix}${e}`,i=["gh-store",this.config.baseLabel,s,...r],a=await this.fetchFromGitHub("/issues",{method:"POST",body:JSON.stringify({title:`Stored Object: ${e}`,body:JSON.stringify(t,null,2),labels:i})});this.cache.set(e,a.number,{createdAt:new Date(a.created_at),updatedAt:new Date(a.updated_at)});let n=this.createCommentPayload(t,a.number,"initial_state"),c=await this.fetchFromGitHub(`/issues/${a.number}/comments`,{method:"POST",body:JSON.stringify({body:JSON.stringify(n,null,2)})});return await this.fetchFromGitHub(`/issues/comments/${c.id}/reactions`,{method:"POST",body:JSON.stringify({content:this.config.reactions.processed})}),await this.fetchFromGitHub(`/issues/comments/${c.id}/reactions`,{method:"POST",body:JSON.stringify({content:this.config.reactions.initialState})}),await this.fetchFromGitHub(`/issues/${a.number}`,{method:"PATCH",body:JSON.stringify({state:"closed"})}),{meta:{objectId:e,label:s,issueNumber:a.number,createdAt:new Date(a.created_at),updatedAt:new Date(a.updated_at),version:1},data:t}}_verifyIssueLabels(e,t){let r=new Set([this.config.baseLabel,`${this.config.uidPrefix}${t}`]);return e.labels.some(s=>r.has(s.name))}async updateObject(e,t){if(!this.token)throw new Error("Authentication required for updating objects");let r=await this.fetchFromGitHub("/issues",{method:"GET",params:{labels:[this.config.baseLabel,`${this.config.uidPrefix}${e}`].join(","),state:"all"}});if(!r||r.length===0)throw new Error(`No object found with ID: ${e}`);let s=r[0],i=this.createCommentPayload(t,s.number);return await this.fetchFromGitHub(`/issues/${s.number}/comments`,{method:"POST",body:JSON.stringify({body:JSON.stringify(i,null,2)})}),await this.fetchFromGitHub(`/issues/${s.number}`,{method:"PATCH",body:JSON.stringify({state:"open"})}),this.getObject(e)}async listAll(){let e=await this.fetchFromGitHub("/issues",{method:"GET",params:{labels:this.config.baseLabel,state:"closed"}}),t={};for(let r of e)if(!r.labels.some(s=>s.name==="archived"))try{let s=this._getObjectIdFromLabels(r),i=JSON.parse(r.body),a={objectId:s,label:s,issueNumber:r.number,createdAt:new Date(r.created_at),updatedAt:new Date(r.updated_at),version:await this._getVersion(r.number)};t[s]={meta:a,data:i};}catch{continue}return t}async listUpdatedSince(e){let t=await this.fetchFromGitHub("/issues",{method:"GET",params:{labels:this.config.baseLabel,state:"closed",since:e.toISOString()}}),r={};for(let s of t)if(!s.labels.some(i=>i.name==="archived"))try{let i=this._getObjectIdFromLabels(s),a=JSON.parse(s.body),n=new Date(s.updated_at);if(n>e){let c={objectId:i,label:i,issueNumber:s.number,createdAt:new Date(s.created_at),updatedAt:n,version:await this._getVersion(s.number)};r[i]={meta:c,data:a};}}catch{continue}return r}async getObjectHistory(e){let t=await this.fetchFromGitHub("/issues",{method:"GET",params:{labels:[this.config.baseLabel,`${this.config.uidPrefix}${e}`].join(","),state:"all"}});if(!t||t.length===0)throw new Error(`No object found with ID: ${e}`);let r=t[0],s=await this.fetchFromGitHub(`/issues/${r.number}/comments`),i=[];for(let a of s)try{let n=JSON.parse(a.body),c="update",u,p={client_version:"legacy",timestamp:a.created_at,update_mode:"append"};typeof n=="object"?"_data"in n?(c=n.type||"update",u=n._data,p=n._meta||p):"type"in n&&n.type==="initial_state"?(c="initial_state",u=n.data):u=n:u=n,i.push({timestamp:a.created_at,type:c,data:u,commentId:a.id});}catch{continue}return i}async _getVersion(e){return (await this.fetchFromGitHub(`/issues/${e}/comments`)).length+1}_getObjectIdFromLabels(e){for(let t of e.labels)if(t.name!==this.config.baseLabel&&t.name.startsWith(this.config.uidPrefix))return t.name.slice(this.config.uidPrefix.length);throw new Error(`No UID label found with prefix ${this.config.uidPrefix}`)}};var E={level:"info",silent:!1},A={error:3,warn:2,info:1,debug:0},b=class{constructor(e,t={}){this.entries=[];this.moduleName=e,this.config={...E,...t};}debug(e,t){this.log("debug",e,t);}info(e,t){this.log("info",e,t);}warn(e,t){this.log("warn",e,t);}error(e,t){this.log("error",e,t);}log(e,t,r){if(A[e]<A[this.config.level])return;let s={timestamp:new Date().toISOString(),level:e,module:this.moduleName,message:t,metadata:r};this.entries.push(s);}getEntries(){return [...this.entries]}clearEntries(){this.entries=[];}configure(e){this.config={...this.config,...e};}getConfig(){return {...this.config}}};new b("CanonicalStore");

// extension/papers/types.ts
// Updated for heartbeat-based session tracking
/**
 * Type guard for interaction log
 */
function isInteractionLog(data) {
    const log = data;
    return (typeof log === 'object' &&
        log !== null &&
        typeof log.sourceId === 'string' &&
        typeof log.paperId === 'string' &&
        Array.isArray(log.interactions));
}

// utils/logger.ts
// Logging utility wrapping loguru
/**
 * Logger class for consistent logging throughout the extension
 */
class Logger {
    constructor(module) {
        this.module = module;
    }
    /**
     * Log debug message
     */
    debug(message, data) {
        console.debug(`[${this.module}] ${message}`, data !== undefined ? data : '');
    }
    /**
     * Log info message
     */
    info(message, data) {
        console.info(`[${this.module}] ${message}`, data !== undefined ? data : '');
    }
    /**
     * Log warning message
     */
    warning(message, data) {
        console.warn(`[${this.module}] ${message}`, data !== undefined ? data : '');
    }
    /**
     * Alias for warning method (to match loguru API)
     */
    warn(message, data) {
        this.warning(message, data);
    }
    /**
     * Log error message
     */
    error(message, data) {
        console.error(`[${this.module}] ${message}`, data !== undefined ? data : '');
    }
}
/**
 * Loguru mock for browser extension use
 */
class LoguruMock {
    /**
     * Get logger for a module
     */
    getLogger(module) {
        return new Logger(module);
    }
}
// Export singleton instance
const loguru = new LoguruMock();

const logger$8 = loguru.getLogger('paper-manager');
class PaperManager {
    constructor(client, sourceManager) {
        this.client = client;
        this.sourceManager = sourceManager;
        logger$8.debug('Paper manager initialized');
    }
    /**
     * Get paper by source and ID
     */
    async getPaper(sourceId, paperId) {
        const objectId = this.sourceManager.formatObjectId('paper', sourceId, paperId);
        try {
            const obj = await this.client.getObject(objectId);
            return obj.data;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('No object found')) {
                return null;
            }
            throw error;
        }
    }
    /**
     * Get or create paper metadata
     */
    async getOrCreatePaper(paperData) {
        const { sourceId, paperId } = paperData;
        const objectId = this.sourceManager.formatObjectId('paper', sourceId, paperId);
        const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
        try {
            const obj = await this.client.getObject(objectId);
            const data = obj.data;
            logger$8.debug(`Retrieved existing paper: ${paperIdentifier}`);
            return data;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('No object found')) {
                // Create new paper
                const defaultPaperData = {
                    ...paperData,
                    timestamp: new Date().toISOString(),
                    rating: paperData.rating || 'novote'
                };
                const newobj = await this.client.createObject(objectId, defaultPaperData);
                logger$8.debug(`Created new paper: ${paperIdentifier}`);
                // reopen to trigger metadata hydration
                await this.client.fetchFromGitHub(`/issues/${newobj.meta.issueNumber}`, {
                    method: "PATCH",
                    body: JSON.stringify({ state: "open" })
                });
                return defaultPaperData;
            }
            throw error;
        }
    }
    /**
     * Get or create interaction log for a paper
     */
    async getOrCreateInteractionLog(sourceId, paperId) {
        const objectId = this.sourceManager.formatObjectId('interactions', sourceId, paperId);
        const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
        try {
            const obj = await this.client.getObject(objectId);
            const data = obj.data;
            if (isInteractionLog(data)) {
                return data;
            }
            throw new Error('Invalid interaction log format');
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('No object found')) {
                const newLog = {
                    sourceId,
                    paperId,
                    interactions: []
                };
                await this.client.createObject(objectId, newLog);
                logger$8.debug(`Created new interaction log: ${paperIdentifier}`);
                return newLog;
            }
            throw error;
        }
    }
    /**
     * Get GitHub client instance
     */
    getClient() {
        return this.client;
    }
    /**
     * Log a reading session
     */
    async logReadingSession(sourceId, paperId, session, paperData) {
        // Ensure paper exists
        if (paperData) {
            await this.getOrCreatePaper({
                sourceId,
                paperId,
                url: paperData.url || this.sourceManager.formatPaperId(sourceId, paperId),
                title: paperData.title || paperId,
                authors: paperData.authors || '',
                abstract: paperData.abstract || '',
                timestamp: new Date().toISOString(),
                rating: 'novote',
                publishedDate: paperData.publishedDate || '',
                tags: paperData.tags || []
            });
        }
        // Log the session as an interaction
        await this.addInteraction(sourceId, paperId, {
            type: 'reading_session',
            timestamp: new Date().toISOString(),
            data: session
        });
        const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
        logger$8.info(`Logged reading session for ${paperIdentifier}`, { duration: session.duration_seconds });
    }
    /**
     * Log an annotation
     */
    async logAnnotation(sourceId, paperId, key, value, paperData) {
        // Ensure paper exists
        if (paperData) {
            await this.getOrCreatePaper({
                sourceId,
                paperId,
                url: paperData.url || this.sourceManager.formatPaperId(sourceId, paperId),
                title: paperData.title || paperId,
                authors: paperData.authors || '',
                abstract: paperData.abstract || '',
                timestamp: new Date().toISOString(),
                rating: 'novote',
                publishedDate: paperData.publishedDate || '',
                tags: paperData.tags || []
            });
        }
        // Log the annotation as an interaction
        await this.addInteraction(sourceId, paperId, {
            type: 'annotation',
            timestamp: new Date().toISOString(),
            data: { key, value }
        });
        const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
        logger$8.info(`Logged annotation for ${paperIdentifier}`, { key });
    }
    /**
     * Update paper rating
     */
    async updateRating(sourceId, paperId, rating, paperData) {
        // Ensure paper exists and get current data
        const paper = await this.getOrCreatePaper({
            sourceId,
            paperId,
            url: paperData?.url || this.sourceManager.formatPaperId(sourceId, paperId),
            title: paperData?.title || paperId,
            authors: paperData?.authors || '',
            abstract: paperData?.abstract || '',
            timestamp: new Date().toISOString(),
            rating: 'novote',
            publishedDate: paperData?.publishedDate || '',
            tags: paperData?.tags || []
        });
        const objectId = this.sourceManager.formatObjectId('paper', sourceId, paperId);
        // Update paper metadata with new rating
        await this.client.updateObject(objectId, {
            ...paper,
            rating
        });
        // Log rating change as an interaction
        await this.addInteraction(sourceId, paperId, {
            type: 'rating',
            timestamp: new Date().toISOString(),
            data: { rating }
        });
        const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
        logger$8.info(`Updated rating for ${paperIdentifier} to ${rating}`);
    }
    /**
     * Add interaction to log
     */
    async addInteraction(sourceId, paperId, interaction) {
        const log = await this.getOrCreateInteractionLog(sourceId, paperId);
        log.interactions.push(interaction);
        const objectId = this.sourceManager.formatObjectId('interactions', sourceId, paperId);
        await this.client.updateObject(objectId, log);
    }
}

// session-service.ts
const logger$7 = loguru.getLogger('session-service');
/**
 * Session tracking service for paper reading sessions
 *
 * Manages session state, heartbeats, and persistence
 * Designed for use in the background script (Service Worker)
 */
class SessionService {
    /**
     * Create a new session service
     */
    constructor(paperManager) {
        this.paperManager = paperManager;
        this.activeSession = null;
        this.timeoutId = null;
        this.paperMetadata = new Map();
        // Configuration
        this.HEARTBEAT_TIMEOUT = 15000; // 15 seconds
        logger$7.debug('Session service initialized');
    }
    /**
     * Start a new session for a paper
     */
    startSession(sourceId, paperId, metadata) {
        // End any existing session
        this.endSession();
        // Create new session
        this.activeSession = {
            sourceId,
            paperId,
            startTime: new Date(),
            heartbeatCount: 0,
            lastHeartbeatTime: new Date()
        };
        // Store metadata if provided
        if (metadata) {
            const key = `${sourceId}:${paperId}`;
            this.paperMetadata.set(key, metadata);
            logger$7.debug(`Stored metadata for ${key}`);
        }
        // Start timeout check
        this.scheduleTimeoutCheck();
        logger$7.info(`Started session for ${sourceId}:${paperId}`);
    }
    /**
     * Record a heartbeat for the current session
     */
    recordHeartbeat() {
        if (!this.activeSession) {
            return false;
        }
        this.activeSession.heartbeatCount++;
        this.activeSession.lastHeartbeatTime = new Date();
        // Reschedule timeout
        this.scheduleTimeoutCheck();
        if (this.activeSession.heartbeatCount % 12 === 0) { // Log every minute (12 x 5sec heartbeats)
            logger$7.debug(`Session received ${this.activeSession.heartbeatCount} heartbeats`);
        }
        return true;
    }
    /**
     * Schedule a check for heartbeat timeout
     */
    scheduleTimeoutCheck() {
        // Clear existing timeout
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
        }
        // Set new timeout
        this.timeoutId = self.setTimeout(() => {
            this.checkTimeout();
        }, this.HEARTBEAT_TIMEOUT);
    }
    /**
     * Check if the session has timed out due to missing heartbeats
     */
    checkTimeout() {
        if (!this.activeSession)
            return;
        const now = Date.now();
        const lastTime = this.activeSession.lastHeartbeatTime.getTime();
        if ((now - lastTime) > this.HEARTBEAT_TIMEOUT) {
            logger$7.info('Session timeout detected');
            this.endSession();
        }
        else {
            this.scheduleTimeoutCheck();
        }
    }
    /**
     * End the current session and get the data
     */
    endSession() {
        if (!this.activeSession)
            return null;
        // Clear timeout
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        const { sourceId, paperId, startTime, heartbeatCount } = this.activeSession;
        const endTime = new Date();
        // Calculate duration (5 seconds per heartbeat)
        const duration = heartbeatCount * 5;
        // Calculate total elapsed time
        const totalElapsed = endTime.getTime() - startTime.getTime();
        const totalElapsedSeconds = Math.round(totalElapsed / 1000);
        // Set idle seconds to the difference (for backward compatibility)
        const idleSeconds = Math.max(0, totalElapsedSeconds - duration);
        // Create session data
        const sessionData = {
            session_id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            source_id: sourceId,
            paper_id: paperId,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            heartbeat_count: heartbeatCount,
            duration_seconds: duration,
            // Legacy fields
            idle_seconds: idleSeconds,
            total_elapsed_seconds: totalElapsedSeconds
        };
        // Store session if it was meaningful and we have a paper manager
        if (this.paperManager && heartbeatCount > 0) {
            const metadata = this.getPaperMetadata(sourceId, paperId);
            this.paperManager.logReadingSession(sourceId, paperId, sessionData, metadata)
                .catch(err => logger$7.error('Failed to store session', err));
        }
        logger$7.info(`Ended session for ${sourceId}:${paperId}`, {
            duration,
            heartbeats: heartbeatCount
        });
        // Clear active session
        this.activeSession = null;
        return sessionData;
    }
    /**
     * Check if a session is currently active
     */
    hasActiveSession() {
        return this.activeSession !== null;
    }
    /**
     * Get information about the current session
     */
    getCurrentSession() {
        if (!this.activeSession)
            return null;
        return {
            sourceId: this.activeSession.sourceId,
            paperId: this.activeSession.paperId
        };
    }
    /**
     * Get paper metadata for the current or specified session
     */
    getPaperMetadata(sourceId, paperId) {
        if (!sourceId || !paperId) {
            if (!this.activeSession)
                return undefined;
            sourceId = this.activeSession.sourceId;
            paperId = this.activeSession.paperId;
        }
        return this.paperMetadata.get(`${sourceId}:${paperId}`);
    }
    /**
     * Store paper metadata
     */
    storePaperMetadata(metadata) {
        const key = `${metadata.sourceId}:${metadata.paperId}`;
        this.paperMetadata.set(key, metadata);
    }
    /**
     * Get time since last heartbeat in milliseconds
     */
    getTimeSinceLastHeartbeat() {
        if (!this.activeSession) {
            return null;
        }
        return Date.now() - this.activeSession.lastHeartbeatTime.getTime();
    }
    /**
     * Get session statistics for debugging
     */
    getSessionStats() {
        if (!this.activeSession) {
            return { active: false };
        }
        return {
            active: true,
            sourceId: this.activeSession.sourceId,
            paperId: this.activeSession.paperId,
            startTime: this.activeSession.startTime.toISOString(),
            heartbeatCount: this.activeSession.heartbeatCount,
            lastHeartbeatTime: this.activeSession.lastHeartbeatTime.toISOString(),
            elapsedTime: Math.round((Date.now() - this.activeSession.startTime.getTime()) / 1000)
        };
    }
}

// extension/utils/popup-manager.ts
const logger$6 = loguru.getLogger('popup-manager');
/**
 * Manages all popup-related functionality
 */
class PopupManager {
    /**
     * Create a new popup manager
     */
    constructor(sourceManagerProvider, paperManagerProvider) {
        this.sourceManagerProvider = sourceManagerProvider;
        this.paperManagerProvider = paperManagerProvider;
        this.setupMessageListeners();
        logger$6.debug('Popup manager initialized');
    }
    /**
     * Set up message listeners for popup-related messages
     */
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Handle popup actions (ratings, notes, etc.)
            if (message.type === 'popupAction') {
                this.handlePopupAction(message.sourceId, message.paperId, message.action, message.data).then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    logger$6.error('Error handling popup action', error);
                    sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                });
                return true; // Will respond asynchronously
            }
            // Handle request to show annotation popup
            if (message.type === 'showAnnotationPopup' && sender.tab?.id) {
                this.handleShowAnnotationPopup(sender.tab.id, message.sourceId, message.paperId, message.position).then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    logger$6.error('Error showing popup', error);
                    sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                });
                return true; // Will respond asynchronously
            }
            return false; // Not handled
        });
    }
    /**
     * Handle a request to show an annotation popup
     */
    async handleShowAnnotationPopup(tabId, sourceId, paperId, position) {
        logger$6.debug(`Showing annotation popup for ${sourceId}:${paperId}`);
        // Check if we have source and paper manager
        const sourceManager = this.sourceManagerProvider();
        const paperManager = this.paperManagerProvider();
        if (!sourceManager) {
            throw new Error('Source manager not initialized');
        }
        if (!paperManager) {
            throw new Error('Paper manager not initialized');
        }
        try {
            // Get paper data
            const paper = await paperManager.getPaper(sourceId, paperId);
            // Create popup HTML
            const html = this.createPopupHtml(paper || {
                sourceId,
                paperId,
                title: paperId,
                authors: '',
                abstract: '',
                url: '',
                timestamp: new Date().toISOString(),
                publishedDate: '',
                tags: [],
                rating: 'novote'
            });
            // Get handlers
            const handlers = this.getStandardPopupHandlers();
            // Send message to content script to show popup
            const message = {
                type: 'showPopup',
                sourceId,
                paperId,
                html,
                handlers,
                position
            };
            await chrome.tabs.sendMessage(tabId, message);
            logger$6.debug(`Sent popup to content script for ${sourceId}:${paperId}`);
        }
        catch (error) {
            logger$6.error(`Error showing popup for ${sourceId}:${paperId}`, error);
            throw error;
        }
    }
    /**
     * Handle popup actions (ratings, notes, etc.)
     */
    async handlePopupAction(sourceId, paperId, action, data) {
        const paperManager = this.paperManagerProvider();
        if (!paperManager) {
            throw new Error('Paper manager not initialized');
        }
        logger$6.debug(`Handling popup action: ${action}`, { sourceId, paperId });
        try {
            if (action === 'rate') {
                await paperManager.updateRating(sourceId, paperId, data.value);
                logger$6.info(`Updated rating for ${sourceId}:${paperId} to ${data.value}`);
            }
            else if (action === 'saveNotes') {
                if (data.value) {
                    await paperManager.logAnnotation(sourceId, paperId, 'notes', data.value);
                    logger$6.info(`Saved notes for ${sourceId}:${paperId}`);
                }
            }
        }
        catch (error) {
            logger$6.error(`Error handling action ${action} for ${sourceId}:${paperId}`, error);
            throw error;
        }
    }
    /**
     * Create HTML for paper popup
     */
    createPopupHtml(paper) {
        return `
      <div class="paper-popup-header">${paper.title || paper.paperId}</div>
      <div class="paper-popup-meta">${paper.authors || ''}</div>
      
      <div class="paper-popup-buttons">
        <button class="vote-button" data-vote="thumbsup" id="btn-thumbsup" ${paper.rating === 'thumbsup' ? 'class="active"' : ''}>👍 Interesting</button>
        <button class="vote-button" data-vote="thumbsdown" id="btn-thumbsdown" ${paper.rating === 'thumbsdown' ? 'class="active"' : ''}>👎 Not Relevant</button>
      </div>
      
      <textarea placeholder="Add notes about this paper..." id="paper-notes"></textarea>
      
      <div class="paper-popup-actions">
        <button class="save-button" id="btn-save">Save</button>
      </div>
    `;
    }
    /**
     * Get standard popup event handlers
     */
    getStandardPopupHandlers() {
        return [
            { selector: '#btn-thumbsup', event: 'click', action: 'rate' },
            { selector: '#btn-thumbsdown', event: 'click', action: 'rate' },
            { selector: '#btn-save', event: 'click', action: 'saveNotes' }
        ];
    }
}

// extension/source-integration/source-manager.ts
const logger$5 = loguru.getLogger('source-manager');
/**
 * Manages source integrations
 */
class SourceIntegrationManager {
    constructor() {
        this.sources = new Map();
        logger$5.info('Source integration manager initialized');
    }
    /**
     * Register a source integration
     */
    registerSource(source) {
        if (this.sources.has(source.id)) {
            logger$5.warning(`Source with ID '${source.id}' already registered, overwriting`);
        }
        this.sources.set(source.id, source);
        logger$5.info(`Registered source: ${source.name} (${source.id})`);
    }
    /**
     * Get all registered sources
     */
    getAllSources() {
        return Array.from(this.sources.values());
    }
    /**
     * Get source that can handle a URL
     */
    getSourceForUrl(url) {
        for (const source of this.sources.values()) {
            if (source.canHandleUrl(url)) {
                logger$5.debug(`Found source for URL '${url}': ${source.id}`);
                return source;
            }
        }
        logger$5.debug(`No source found for URL: ${url}`);
        return null;
    }
    /**
     * Get source by ID
     */
    getSourceById(sourceId) {
        const source = this.sources.get(sourceId);
        return source || null;
    }
    /**
     * Extract paper ID from URL using appropriate source
     */
    extractPaperId(url) {
        for (const source of this.sources.values()) {
            if (source.canHandleUrl(url)) {
                const paperId = source.extractPaperId(url);
                if (paperId) {
                    logger$5.debug(`Extracted paper ID '${paperId}' from URL using ${source.id}`);
                    return { sourceId: source.id, paperId };
                }
            }
        }
        logger$5.debug(`Could not extract paper ID from URL: ${url}`);
        return null;
    }
    /**
     * Format a paper identifier using the appropriate source
     */
    formatPaperId(sourceId, paperId) {
        const source = this.sources.get(sourceId);
        if (source) {
            return source.formatPaperId(paperId);
        }
        // Fallback if source not found
        logger$5.warning(`Source '${sourceId}' not found, using default format for paper ID`);
        return `${sourceId}.${paperId}`;
    }
    /**
     * Format an object ID using the appropriate source
     */
    formatObjectId(type, sourceId, paperId) {
        const source = this.sources.get(sourceId);
        if (source) {
            return source.formatObjectId(type, paperId);
        }
        // Fallback if source not found
        logger$5.warning(`Source '${sourceId}' not found, using default format for object ID`);
        return `${type}:${sourceId}.${paperId}`;
    }
    /**
     * Get all content script match patterns
     */
    getAllContentScriptMatches() {
        const patterns = [];
        for (const source of this.sources.values()) {
            patterns.push(...source.contentScriptMatches);
        }
        return patterns;
    }
}

// extension/source-integration/metadata-extractor.ts
const logger$4 = loguru.getLogger('metadata-extractor');
// Constants for standard source types
const SOURCE_TYPES = {
    PDF: 'pdf',
    URL: 'url',
};
/**
 * Base class for metadata extraction with customizable extraction methods
 * Each method can be overridden to provide source-specific extraction
 */
class MetadataExtractor {
    /**
     * Create a new metadata extractor for a document
     */
    constructor(document) {
        this.document = document;
        this.url = document.location.href;
        logger$4.debug('Initialized metadata extractor for:', this.url);
    }
    /**
     * Helper method to get content from meta tags
     */
    getMetaContent(selector) {
        const element = this.document.querySelector(selector);
        return element ? element.getAttribute('content') || '' : '';
    }
    /**
     * Extract and return all metadata fields
     */
    extract() {
        logger$4.debug('Extracting metadata from page:', this.url);
        const metadata = {
            title: this.extractTitle(),
            authors: this.extractAuthors(),
            description: this.extractDescription(),
            publishedDate: this.extractPublishedDate(),
            doi: this.extractDoi(),
            journalName: this.extractJournalName(),
            tags: this.extractTags(),
            url: this.url
        };
        logger$4.debug('Metadata extraction complete:', metadata);
        return metadata;
    }
    /**
     * Extract title from document
     * Considers multiple metadata standards with priority order, then DOM fallbacks
     */
    extractTitle() {
        // Title extraction from meta tags - priority order
        const metaTitle = (
        // Dublin Core
        this.getMetaContent('meta[name="DC.Title"]') || this.getMetaContent('meta[name="dc.title"]') ||
            // Citation
            this.getMetaContent('meta[name="citation_title"]') ||
            // Open Graph
            this.getMetaContent('meta[property="og:title"]') ||
            // Standard meta
            this.getMetaContent('meta[name="title"]'));
        if (metaTitle) {
            return metaTitle;
        }
        // DOM-based fallback extraction
        // Look for common paper title patterns in the page
        const titleSelectors = [
            // Common academic page patterns
            'h1.title', 'h1.article-title', 'h1.paper-title', 'h1.document-title',
            '.title h1', '.article-title h1', '.paper-title h1',
            'h1[itemprop="headline"]', 'h1[itemprop="name"]',
            '.citation_title', '.paper-title', '.article-title',
            // Generic heading patterns
            'article h1', 'main h1', '.content h1', '#content h1',
            // PDF viewer fallbacks
            '.page-title', '#title',
            // First h1 on the page as last resort before document.title
            'h1'
        ];
        for (const selector of titleSelectors) {
            const element = this.document.querySelector(selector);
            if (element) {
                const text = element.textContent?.trim();
                // Only use if it looks like a real title (not too short, not navigation)
                if (text && text.length > 5 && text.length < 500) {
                    return text;
                }
            }
        }
        // Fallback to document title
        return this.document.title;
    }
    /**
     * Extract authors from document
     * Handles multiple author formats and sources with DOM fallbacks
     */
    extractAuthors() {
        // Get all citation authors (some pages have multiple citation_author tags)
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        // Get all DC creators
        const dcCreators = [];
        this.document.querySelectorAll('meta[name="DC.Creator.PersonalName"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                dcCreators.push(content);
        });
        // Individual author elements
        const dcCreator = this.getMetaContent('meta[name="DC.Creator.PersonalName"]') || this.getMetaContent('meta[name="dc.creator.personalname"]');
        const citationAuthor = this.getMetaContent('meta[name="citation_author"]');
        const ogAuthor = this.getMetaContent('meta[property="og:article:author"]') ||
            this.getMetaContent('meta[name="author"]');
        // Set authors with priority from meta tags
        if (dcCreators.length > 0) {
            return dcCreators.join(', ');
        }
        else if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        else if (dcCreator) {
            return dcCreator;
        }
        else if (citationAuthor) {
            return citationAuthor;
        }
        else if (ogAuthor) {
            return ogAuthor;
        }
        // DOM-based fallback extraction
        const authorSelectors = [
            // Common academic page patterns
            '.authors a', '.author a', '.author-name a',
            '.authors', '.author', '.author-name', '.author-list',
            '[itemprop="author"]', '[rel="author"]',
            '.byline', '.by-line', '.article-author', '.paper-author',
            '.contributor', '.contributors',
            // arXiv-like patterns
            '.authors', '.authors-list',
            // IEEE/ACM patterns
            '.authors-info .author span', '.author-info',
            // Nature/Science patterns
            '.c-article-author-list', '.article-authors',
            // Generic patterns
            '.meta-authors', '#authors', '.author-block'
        ];
        for (const selector of authorSelectors) {
            const elements = this.document.querySelectorAll(selector);
            if (elements.length > 0) {
                const authors = [];
                elements.forEach(el => {
                    const text = el.textContent?.trim();
                    if (text && text.length > 1 && text.length < 200) {
                        // Clean up common prefixes
                        const cleaned = text
                            .replace(/^(by|authors?:?|written by)\s*/i, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                        if (cleaned) {
                            authors.push(cleaned);
                        }
                    }
                });
                if (authors.length > 0) {
                    // If we got multiple elements, join them
                    // If we got one element that looks like a comma-separated list, return as-is
                    const result = authors.join(', ');
                    if (result.length > 2) {
                        return result;
                    }
                }
            }
        }
        return '';
    }
    /**
     * Extract description/abstract from document with DOM fallbacks
     */
    extractDescription() {
        // Try meta tags first
        const metaDescription = (this.getMetaContent('meta[name="DC.Description"]') || this.getMetaContent('meta[name="dc.description"]') ||
            this.getMetaContent('meta[name="citation_abstract"]') ||
            this.getMetaContent('meta[property="og:description"]') ||
            this.getMetaContent('meta[name="description"]'));
        if (metaDescription && metaDescription.length > 50) {
            return metaDescription;
        }
        // DOM-based fallback extraction for abstracts
        const abstractSelectors = [
            // Common academic patterns
            '.abstract', '#abstract', '[id*="abstract"]', '[class*="abstract"]',
            '.Abstract', '#Abstract',
            // Specific patterns
            '.abstractSection', '.abstract-content', '.abstract-text',
            '.paper-abstract', '.article-abstract',
            // arXiv patterns
            'blockquote.abstract',
            // Summary patterns (some sites use "summary" instead of "abstract")
            '.summary', '#summary', '.article-summary',
            // IEEE/ACM patterns
            '.abstract-text', '.abstractInFull',
            // Nature/Science patterns
            '.c-article-section__content', '[data-component="article-abstract"]',
            // Schema.org patterns
            '[itemprop="description"]', '[itemprop="abstract"]'
        ];
        for (const selector of abstractSelectors) {
            const element = this.document.querySelector(selector);
            if (element) {
                let text = element.textContent?.trim() || '';
                // Clean up the abstract
                text = text
                    .replace(/^(abstract:?|summary:?)\s*/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                // Only use if it looks like a real abstract (not too short)
                if (text.length > 100) {
                    return text;
                }
            }
        }
        // If we have a short meta description, return it as fallback
        if (metaDescription) {
            return metaDescription;
        }
        return '';
    }
    /**
     * Extract publication date from document with DOM fallbacks
     */
    extractPublishedDate() {
        // Try meta tags first
        const metaDate = (this.getMetaContent('meta[name="DC.Date.issued"]') || this.getMetaContent('meta[name="dc.date.issued"]') ||
            this.getMetaContent('meta[name="dc.date"]') || this.getMetaContent('meta[name="dc.Date"]') ||
            this.getMetaContent('meta[name="DC.Date"]') ||
            this.getMetaContent('meta[name="citation_date"]') ||
            this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_online_date"]') ||
            this.getMetaContent('meta[property="article:published_time"]') ||
            this.getMetaContent('meta[property="article:modified_time"]'));
        if (metaDate) {
            return metaDate;
        }
        // DOM-based fallback extraction
        const dateSelectors = [
            // Common patterns
            '.date', '.pub-date', '.publication-date', '.published-date',
            '.article-date', '.paper-date', '.dateline',
            '[itemprop="datePublished"]', '[itemprop="dateCreated"]',
            'time[datetime]', 'time[pubdate]',
            // arXiv patterns
            '.dateline', '.submission-history',
            // Specific patterns
            '.meta-date', '.entry-date', '.post-date'
        ];
        for (const selector of dateSelectors) {
            const element = this.document.querySelector(selector);
            if (element) {
                // Check for datetime attribute first (more reliable)
                const datetime = element.getAttribute('datetime') || element.getAttribute('content');
                if (datetime) {
                    return datetime;
                }
                // Fall back to text content
                const text = element.textContent?.trim();
                if (text && this.looksLikeDate(text)) {
                    return text;
                }
            }
        }
        return '';
    }
    /**
     * Check if a string looks like a date
     */
    looksLikeDate(text) {
        // Common date patterns
        const datePatterns = [
            /\d{4}-\d{2}-\d{2}/, // ISO format
            /\d{1,2}\/\d{1,2}\/\d{2,4}/, // US format
            /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i, // Month name
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i, // Month name
            /(January|February|March|April|May|June|July|August|September|October|November|December)/i,
            /\d{4}/ // Just a year
        ];
        return datePatterns.some(pattern => pattern.test(text));
    }
    /**
     * Extract DOI (Digital Object Identifier) from document with URL and DOM fallbacks
     */
    extractDoi() {
        // Try meta tags first
        const metaDoi = (this.getMetaContent('meta[name="DC.Identifier.DOI"]') || this.getMetaContent('meta[name="dc.identifier.doi"]') ||
            this.getMetaContent('meta[name="citation_doi"]') ||
            this.getMetaContent('meta[name="DOI"]') || this.getMetaContent('meta[name="doi"]'));
        if (metaDoi) {
            return metaDoi;
        }
        // Try to extract DOI from URL
        const doiFromUrl = this.extractDoiFromUrl(this.url);
        if (doiFromUrl) {
            return doiFromUrl;
        }
        // DOM-based fallback - look for DOI links or text
        const doiSelectors = [
            'a[href*="doi.org/10."]',
            'a[href*="/doi/10."]',
            '.doi', '#doi', '[class*="doi"]'
        ];
        for (const selector of doiSelectors) {
            const element = this.document.querySelector(selector);
            if (element) {
                // Check href for DOI
                const href = element.getAttribute('href');
                if (href) {
                    const doi = this.extractDoiFromUrl(href);
                    if (doi)
                        return doi;
                }
                // Check text content
                const text = element.textContent?.trim();
                if (text) {
                    const doiMatch = text.match(/10\.\d{4,}\/[^\s]+/);
                    if (doiMatch) {
                        return doiMatch[0];
                    }
                }
            }
        }
        return '';
    }
    /**
     * Extract DOI from a URL
     */
    extractDoiFromUrl(url) {
        // Common DOI URL patterns
        const doiPatterns = [
            /doi\.org\/(10\.\d{4,}\/[^\s?#]+)/i,
            /\/doi\/(?:abs|full|pdf|epdf)?\/?((10\.\d{4,}\/[^\s?#]+))/i,
            /doi[=:](10\.\d{4,}\/[^\s&?#]+)/i
        ];
        for (const pattern of doiPatterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1] || match[2];
            }
        }
        return '';
    }
    /**
     * Extract journal name from document
     */
    extractJournalName() {
        return (this.getMetaContent('meta[name="DC.Source"]') || this.getMetaContent('meta[name="dc.source"]') ||
            this.getMetaContent('meta[name="citation_journal_title"]'));
    }
    /**
     * Extract keywords/tags from document
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="keywords"]') ||
            this.getMetaContent('meta[name="DC.Subject"]') || this.getMetaContent('meta[name="dc.subject"]');
        if (keywords) {
            return keywords.split(',').map(tag => tag.trim());
        }
        return [];
    }
    /**
     * Determine if the current URL is a PDF
     */
    isPdf() {
        return isPdfUrl(this.url);
    }
    /**
     * Get the source type (PDF or URL)
     */
    getSourceType() {
        return this.isPdf() ? SOURCE_TYPES.PDF : SOURCE_TYPES.URL;
    }
    /**
     * Generate a paper ID for the current URL
     */
    generatePaperId() {
        return generatePaperIdFromUrl(this.url);
    }
}
/**
 * Create a common metadata extractor for a document
 * Factory function for creating the default extractor
 */
function createMetadataExtractor(document) {
    return new MetadataExtractor(document);
}
/**
 * Generate a paper ID from a URL
 * Creates a consistent hash-based identifier
 */
function generatePaperIdFromUrl(url) {
    // Use a basic hash function to create an ID from the URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Create a positive hexadecimal string
    const positiveHash = Math.abs(hash).toString(16).toUpperCase();
    // Use the first 8 characters as the ID
    return positiveHash.substring(0, 8);
}
/**
 * Determine if a URL is a PDF
 */
function isPdfUrl(url) {
    return url.toLowerCase().endsWith('.pdf');
}

// extension/source-integration/base-source.ts
const logger$3 = loguru.getLogger('base-source');
/**
 * Base class for source integrations
 * Provides default implementations for all methods
 * Specific sources can override as needed
 */
class BaseSourceIntegration {
    constructor() {
        // Default properties - set for generic web pages
        this.id = 'url';
        this.name = 'Web Page';
        this.urlPatterns = [
            /^https?:\/\/(?!.*\.pdf($|\?|#)).*$/i // Match HTTP/HTTPS URLs that aren't PDFs
        ];
        this.contentScriptMatches = [];
    }
    /**
     * Check if this integration can handle the given URL
     * Default implementation checks against urlPatterns
     */
    canHandleUrl(url) {
        return this.urlPatterns.some(pattern => pattern.test(url));
    }
    /**
     * Extract paper ID from URL
     * Default implementation creates a hash from the URL
     */
    extractPaperId(url) {
        return generatePaperIdFromUrl(url);
    }
    /**
     * Create a metadata extractor for the given document
     * Override this method to provide a custom extractor for your source
     */
    createMetadataExtractor(document) {
        return createMetadataExtractor(document);
    }
    /**
     * Extract metadata from a page
     * Default implementation uses common metadata extraction
     */
    async extractMetadata(document, paperId) {
        try {
            logger$3.debug(`Extracting metadata using base extractor for ID: ${paperId}`);
            // Create a metadata extractor for this document
            const extractor = this.createMetadataExtractor(document);
            // Extract metadata
            const extracted = extractor.extract();
            const url = document.location.href;
            // Determine source type (PDF or URL)
            const sourceType = extractor.getSourceType();
            // Create PaperMetadata object
            return {
                sourceId: this.id,
                //paperId: this.formatPaperId(paperId),
                paperId: paperId,
                url: url,
                title: extracted.title || document.title || paperId,
                authors: extracted.authors || '',
                abstract: extracted.description || '',
                timestamp: new Date().toISOString(),
                rating: 'novote',
                publishedDate: extracted.publishedDate || '',
                tags: extracted.tags || [],
                doi: extracted.doi,
                journalName: extracted.journalName,
                sourceType: sourceType // Store the source type for reference
            };
        }
        catch (error) {
            logger$3.error('Error extracting metadata with base extractor', error);
            return null;
        }
    }
    /**
     * Format a paper identifier for this source
     * Default implementation uses the format: sourceId.paperId
     */
    formatPaperId(paperId) {
        return `${this.id}.${paperId}`;
    }
    /**
     * Parse a paper identifier specific to this source
     * Default implementation handles source.paperId format and extracts paperId
     */
    parsePaperId(identifier) {
        const prefix = `${this.id}.`;
        if (identifier.startsWith(prefix)) {
            return identifier.substring(prefix.length);
        }
        // Try legacy format (sourceId:paperId)
        const legacyPrefix = `${this.id}:`;
        if (identifier.startsWith(legacyPrefix)) {
            logger$3.debug(`Parsed legacy format identifier: ${identifier}`);
            return identifier.substring(legacyPrefix.length);
        }
        return null;
    }
    /**
     * Format a storage object ID for this source
     * Default implementation uses the format: type:sourceId.paperId
     */
    formatObjectId(type, paperId) {
        return `${type}:${this.formatPaperId(paperId)}`;
    }
}

// extension/source-integration/arxiv/index.ts
const logger$2 = loguru.getLogger('arxiv-integration');
/**
 * Custom metadata extractor for arXiv pages
 */
class ArxivMetadataExtractor extends MetadataExtractor {
    constructor(document, apiMetadata) {
        super(document);
        this.apiMetadata = apiMetadata;
    }
    /**
     * Override title extraction to use API data if available
     */
    extractTitle() {
        if (this.apiMetadata?.title) {
            return this.apiMetadata.title;
        }
        return super.extractTitle();
    }
    /**
     * Override authors extraction to use API data if available
     */
    extractAuthors() {
        if (this.apiMetadata?.authors) {
            return this.apiMetadata.authors;
        }
        // arXiv-specific selectors
        const authorLinks = this.document.querySelectorAll('.authors a');
        if (authorLinks.length > 0) {
            return Array.from(authorLinks)
                .map(link => link.textContent?.trim())
                .filter(Boolean)
                .join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Override description extraction to use API data if available
     */
    extractDescription() {
        if (this.apiMetadata?.description) {
            return this.apiMetadata.description;
        }
        // arXiv-specific selectors
        const abstract = this.document.querySelector('.abstract')?.textContent?.trim();
        if (abstract) {
            // Remove "Abstract:" prefix if present
            return abstract.replace(/^Abstract:\s*/i, '');
        }
        return super.extractDescription();
    }
    /**
     * Override published date extraction to use API data if available
     */
    extractPublishedDate() {
        if (this.apiMetadata?.publishedDate) {
            return this.apiMetadata.publishedDate;
        }
        // arXiv-specific date extraction
        const datelineElement = this.document.querySelector('.dateline');
        if (datelineElement) {
            const dateText = datelineElement.textContent;
            const dateMatch = dateText?.match(/\(Submitted on ([^)]+)\)/);
            if (dateMatch) {
                return dateMatch[1];
            }
        }
        return super.extractPublishedDate();
    }
    /**
     * Override DOI extraction to use API data if available
     */
    extractDoi() {
        return this.apiMetadata?.doi || super.extractDoi();
    }
    /**
     * Override journal extraction to use API data if available
     */
    extractJournalName() {
        return this.apiMetadata?.journalName || super.extractJournalName();
    }
    /**
     * Override tags extraction to use API data if available
     */
    extractTags() {
        if (this.apiMetadata?.tags) {
            return this.apiMetadata.tags;
        }
        // arXiv-specific category extraction
        const subjects = this.document.querySelector('.subjects')?.textContent?.trim();
        if (subjects) {
            return subjects.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * ArXiv integration with custom metadata extraction
 */
class ArXivIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'arxiv';
        this.name = 'arXiv.org';
        // URL patterns for papers
        this.urlPatterns = [
            /arxiv\.org\/(abs|pdf|html)\/([0-9.]+)/,
            /arxiv\.org\/\w+\/([0-9.]+)/
        ];
        // Content script matches
        // readonly contentScriptMatches = [
        //   "*://*.arxiv.org/*"
        // ];
        // ArXiv API endpoint
        this.API_BASE_URL = 'https://export.arxiv.org/api/query';
    }
    /**
     * Extract paper ID from URL
     */
    extractPaperId(url) {
        for (const pattern of this.urlPatterns) {
            const match = url.match(pattern);
            if (match) {
                return match[2] || match[1]; // The capture group with the paper ID
            }
        }
        return null;
    }
    /**
     * Create a custom metadata extractor for arXiv
     */
    createMetadataExtractor(document) {
        return new ArxivMetadataExtractor(document);
    }
    /**
     * Fetch metadata from ArXiv API
     */
    async fetchFromApi(paperId) {
        try {
            const apiUrl = `${this.API_BASE_URL}?id_list=${paperId}`;
            logger$2.debug(`Fetching from ArXiv API: ${apiUrl}`);
            const response = await fetch(apiUrl);
            if (!response.ok) {
                logger$2.error(`ArXiv API request failed with status: ${response.status}`);
                return null;
            }
            const xmlText = await response.text();
            // Parse XML to JSON
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            // Convert XML to a more manageable format
            const entry = xmlDoc.querySelector('entry');
            if (!entry) {
                logger$2.warn('No entry found in ArXiv API response');
                return null;
            }
            // Extract metadata from XML
            const title = entry.querySelector('title')?.textContent?.trim() || '';
            const summary = entry.querySelector('summary')?.textContent?.trim() || '';
            const published = entry.querySelector('published')?.textContent?.trim() || '';
            // Extract authors
            const authorElements = entry.querySelectorAll('author name');
            const authors = Array.from(authorElements)
                .map(el => el.textContent?.trim())
                .filter(Boolean)
                .join(', ');
            // Extract DOI if available
            const doi = entry.querySelector('arxiv\\:doi, doi')?.textContent?.trim();
            // Extract journal reference if available
            const journalRef = entry.querySelector('arxiv\\:journal_ref, journal_ref')?.textContent?.trim();
            // Extract categories
            const categoryElements = entry.querySelectorAll('category');
            const categories = Array.from(categoryElements)
                .map(el => el.getAttribute('term'))
                .filter(Boolean);
            return {
                title,
                authors,
                description: summary,
                publishedDate: published,
                doi,
                journalName: journalRef,
                tags: categories
            };
        }
        catch (error) {
            logger$2.error('Error fetching from ArXiv API', error);
            return null;
        }
    }
    /**
     * Extract metadata from page or fetch from API
     * Override parent method to handle the API fallback
     */
    async extractMetadata(document, paperId) {
        try {
            logger$2.info(`Extracting metadata for arXiv ID: ${paperId}`);
            // Try to extract from page first
            const extractor = this.createMetadataExtractor(document);
            const pageMetadata = extractor.extract();
            // Check if we have the essential fields
            const hasTitle = pageMetadata.title && pageMetadata.title !== document.title;
            const hasAuthors = pageMetadata.authors && pageMetadata.authors.length > 0;
            const hasAbstract = pageMetadata.description && pageMetadata.description.length > 0;
            if (hasTitle && hasAuthors && hasAbstract) {
                logger$2.debug('Successfully extracted complete metadata from page');
                return this.convertToPageMetadata(pageMetadata, paperId, extractor.getSourceType());
            }
            // If page extraction is incomplete, fetch from API
            logger$2.info('Page metadata incomplete, fetching from ArXiv API');
            const apiMetadata = await this.fetchFromApi(paperId);
            if (!apiMetadata) {
                logger$2.warn('Failed to fetch metadata from ArXiv API, using partial page data');
                return this.convertToPageMetadata(pageMetadata, paperId, extractor.getSourceType());
            }
            // Create a new extractor with API data
            const enhancedExtractor = new ArxivMetadataExtractor(document, apiMetadata);
            const mergedMetadata = enhancedExtractor.extract();
            logger$2.debug('Merged metadata from page and API', mergedMetadata);
            return this.convertToPageMetadata(mergedMetadata, paperId, enhancedExtractor.getSourceType());
        }
        catch (error) {
            logger$2.error('Error extracting metadata for arXiv', error);
            return null;
        }
    }
    /**
     * Convert ExtractedMetadata to PaperMetadata
     */
    convertToPageMetadata(extracted, paperId, sourceType) {
        return {
            sourceId: this.id,
            paperId: paperId,
            url: extracted.url || '',
            title: extracted.title,
            authors: extracted.authors,
            abstract: extracted.description,
            timestamp: new Date().toISOString(),
            rating: 'novote',
            publishedDate: extracted.publishedDate,
            tags: extracted.tags || [],
            doi: extracted.doi,
            journalName: extracted.journalName,
            sourceType: sourceType
        };
    }
}
// Export a singleton instance that can be used by both background and content scripts
const arxivIntegration = new ArXivIntegration();

// extension/source-integration/openreview/index.ts
const logger$1 = loguru.getLogger('openreview-integration');
/**
 * Custom metadata extractor for OpenReview pages
 */
class OpenReviewMetadataExtractor extends MetadataExtractor {
    /**
     * Extract metadata from OpenReview pages
     */
    extract() {
        // First try to extract using standard methods
        const baseMetadata = super.extract();
        try {
            // Get title from OpenReview-specific elements
            const title = this.document.querySelector('.citation_title')?.textContent ||
                this.document.querySelector('.forum-title h2')?.textContent;
            // Get authors
            const authorElements = Array.from(this.document.querySelectorAll('.forum-authors a'));
            const authors = authorElements
                .map(el => el.textContent)
                .filter(Boolean)
                .join(', ');
            // Get abstract
            const abstract = this.document.querySelector('meta[name="citation_abstract"]')?.getAttribute('content') ||
                Array.from(this.document.querySelectorAll('.note-content-field'))
                    .find(el => el.textContent?.includes('Abstract'))
                    ?.nextElementSibling?.textContent;
            // Get publication date
            const dateText = this.document.querySelector('.date.item')?.textContent;
            let publishedDate = '';
            if (dateText) {
                const dateMatch = dateText.match(/Published: ([^,]+)/);
                if (dateMatch) {
                    publishedDate = dateMatch[1];
                }
            }
            // Get DOI if available
            const doi = this.document.querySelector('meta[name="citation_doi"]')?.getAttribute('content') || '';
            // Get conference/journal name
            const venueElements = this.document.querySelectorAll('.forum-meta .item');
            let venue = '';
            for (let i = 0; i < venueElements.length; i++) {
                const el = venueElements[i];
                if (el.querySelector('.glyphicon-folder-open')) {
                    venue = el.textContent?.trim() || '';
                    break;
                }
            }
            // Get tags/keywords
            const keywordsElement = Array.from(this.document.querySelectorAll('.note-content-field'))
                .find(el => el.textContent?.includes('Keywords'));
            let tags = [];
            if (keywordsElement) {
                const keywordsValue = keywordsElement.nextElementSibling?.textContent;
                if (keywordsValue) {
                    tags = keywordsValue.split(',').map(tag => tag.trim());
                }
            }
            return {
                title: title || baseMetadata.title,
                authors: authors || baseMetadata.authors,
                description: abstract || baseMetadata.description,
                publishedDate: publishedDate || baseMetadata.publishedDate,
                doi: doi || baseMetadata.doi,
                journalName: venue || baseMetadata.journalName,
                tags: tags.length ? tags : baseMetadata.tags,
                url: this.url
            };
        }
        catch (error) {
            logger$1.error('Error during OpenReview-specific extraction', error);
            return baseMetadata;
        }
    }
}
/**
 * OpenReview integration with custom metadata extraction
 */
class OpenReviewIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'openreview';
        this.name = 'OpenReview';
        // URL patterns for papers (various OpenReview formats)
        this.urlPatterns = [
            // Forum page (main paper page)
            /openreview\.net\/forum\?id=([a-zA-Z0-9_-]+)/,
            // PDF page
            /openreview\.net\/pdf\?id=([a-zA-Z0-9_-]+)/,
            // Attachment URLs
            /openreview\.net\/attachment\?id=([a-zA-Z0-9_-]+)/,
            // References/revisions
            /openreview\.net\/references\?referent=([a-zA-Z0-9_-]+)/,
            /openreview\.net\/revisions\?id=([a-zA-Z0-9_-]+)/,
            // Group/venue pages (for browsing)
            /openreview\.net\/group\?id=([^&\s]+)/,
            // Generic OpenReview paper URL
            /openreview\.net\/(?:forum|pdf)\?id=/,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /openreview\.net\/(forum|pdf|attachment|references|revisions)\?id=/.test(url);
    }
    /**
     * Extract paper ID from URL
     */
    extractPaperId(url) {
        // Try to extract ID from various URL formats
        const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch) {
            return idMatch[1];
        }
        // Try referent parameter
        const referentMatch = url.match(/[?&]referent=([a-zA-Z0-9_-]+)/);
        if (referentMatch) {
            return referentMatch[1];
        }
        return null;
    }
    /**
     * Create a custom metadata extractor for OpenReview
     */
    createMetadataExtractor(document) {
        return new OpenReviewMetadataExtractor(document);
    }
    /**
     * Extract metadata from page
     * Override parent method to handle OpenReview-specific extraction
     */
    async extractMetadata(document, paperId) {
        logger$1.info(`Extracting metadata for OpenReview ID: ${paperId}`);
        // Extract metadata using our custom extractor
        const metadata = await super.extractMetadata(document, paperId);
        if (metadata) {
            // Add any OpenReview-specific metadata processing here
            logger$1.debug('Extracted metadata from OpenReview page');
            // Check if we're on a PDF page and adjust metadata accordingly
            if (document.location.href.includes('/pdf?id=')) {
                metadata.sourceType = 'pdf';
            }
        }
        return metadata;
    }
}
// Export a singleton instance that can be used by both background and content scripts
const openReviewIntegration = new OpenReviewIntegration();

// extension/source-integration/nature/index.ts
loguru.getLogger('nature-integration');
/**
 * Custom metadata extractor for Nature.com pages
 */
class NatureMetadataExtractor extends MetadataExtractor {
    /**
     * Override title extraction to use meta tag first
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Override authors extraction to use meta tag first
     */
    extractAuthors() {
        const metaAuthors = this.getMetaContent('meta[name="citation_author"]');
        if (metaAuthors) {
            return metaAuthors;
        }
        // Fallback to HTML extraction
        const authorElements = this.document.querySelectorAll('.c-article-author-list__item');
        if (authorElements.length > 0) {
            return Array.from(authorElements)
                .map(el => el.textContent?.trim())
                .filter(Boolean)
                .join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract keywords/tags from document
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="dc.subject"]');
        if (keywords) {
            return keywords.split(',').map(tag => tag.trim());
        }
        return [];
    }
    /**
     * Override description extraction to use meta tag first
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        return metaDescription || super.extractDescription();
    }
    /**
     * Override published date extraction to use meta tag
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') || super.extractPublishedDate();
    }
    /**
     * Override DOI extraction to use meta tag
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') || super.extractDoi();
    }
}
/**
 * Nature.com integration with custom metadata extraction
 */
class NatureIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'nature';
        this.name = 'Nature';
        // URL patterns for Nature articles (including all Nature journals)
        this.urlPatterns = [
            // Main nature.com articles
            /nature\.com\/articles\/([^?#/]+)/,
            // Nature sub-journals (e.g., nature.com/ncomms/articles/...)
            /nature\.com\/\w+\/articles\/([^?#/]+)/,
            // Scientific Reports
            /nature\.com\/srep\/articles\/([^?#/]+)/,
            // Nature Communications
            /nature\.com\/ncomms\/articles\/([^?#/]+)/,
            // Nature Methods, Nature Reviews, etc.
            /nature\.com\/n[a-z]+\/articles\/([^?#/]+)/,
            // DOI-based URLs
            /nature\.com\/doi\/(10\.\d+\/[^?#\s]+)/,
            // Full text and PDF variants
            /nature\.com\/articles\/([^?#/]+)\.pdf/,
            /nature\.com\/articles\/([^?#/]+)\/full/,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /nature\.com\/(articles|doi)\//.test(url) ||
            /nature\.com\/\w+\/articles\//.test(url);
    }
    /**
     * Extract paper ID from URL
     */
    extractPaperId(url) {
        // Try to extract article ID
        const articleMatch = url.match(/nature\.com\/(?:\w+\/)?articles\/([^?#/]+)/);
        if (articleMatch) {
            return articleMatch[1].replace(/\.pdf$/, '');
        }
        // Try DOI format
        const doiMatch = url.match(/nature\.com\/doi\/(10\.\d+\/[^?#\s]+)/);
        if (doiMatch) {
            return doiMatch[1];
        }
        return null;
    }
    /**
     * Create a custom metadata extractor for Nature.com
     */
    createMetadataExtractor(document) {
        return new NatureMetadataExtractor(document);
    }
}
// Export a singleton instance 
const natureIntegration = new NatureIntegration();

// extension/source-integration/pnas/index.ts
class PnasIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'pnas';
        this.name = 'PNAS';
        // URL patterns for PNAS articles
        this.urlPatterns = [
            // DOI-based URLs (most common)
            /pnas\.org\/doi\/(10\.1073\/pnas\.[0-9]+)/,
            /pnas\.org\/doi\/abs\/(10\.1073\/pnas\.[0-9]+)/,
            /pnas\.org\/doi\/full\/(10\.1073\/pnas\.[0-9]+)/,
            /pnas\.org\/doi\/pdf\/(10\.1073\/pnas\.[0-9]+)/,
            /pnas\.org\/doi\/epdf\/(10\.1073\/pnas\.[0-9]+)/,
            // Alternate DOI formats
            /pnas\.org\/doi\/(10\.1073\/[^\s?#]+)/,
            // Content-based URLs (older format)
            /pnas\.org\/content\/(\d+\/\d+\/[^\s?#]+)/,
            /pnas\.org\/content\/early\/\d+\/\d+\/\d+\/(\d+)/,
            // Legacy cgi format
            /pnas\.org\/cgi\/doi\/(10\.1073\/[^\s?#]+)/,
            // Generic PNAS DOI pattern
            /pnas\.org\/doi\//,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /pnas\.org\/(doi|content|cgi)\//.test(url);
    }
    /**
     * Extract paper ID (DOI) from URL
     */
    extractPaperId(url) {
        // Try DOI format
        const doiMatch = url.match(/pnas\.org\/(?:doi\/(?:abs|full|pdf|epdf)?\/?)?(10\.1073\/[^\s?#]+)/);
        if (doiMatch) {
            return doiMatch[1];
        }
        // Try content-based format
        const contentMatch = url.match(/content\/(\d+\/\d+\/[^\s?#.]+)/);
        if (contentMatch) {
            return contentMatch[1];
        }
        // Try early format
        const earlyMatch = url.match(/early\/\d+\/\d+\/\d+\/(\d+)/);
        if (earlyMatch) {
            return earlyMatch[1];
        }
        return null;
    }
}
const pnasIntegration = new PnasIntegration();

// extension/source-integration/sciencedirect/index.ts
loguru.getLogger('sciencedirect-integration');
/**
 * Custom metadata extractor for ScienceDirect pages
 */
class ScienceDirectMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_online_date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract DOI
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') || super.extractDoi();
    }
    /**
     * Extract journal name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_journal_title"]') || super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * ScienceDirect integration for Elsevier journals
 */
class ScienceDirectIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'sciencedirect';
        this.name = 'ScienceDirect';
        // URL patterns for ScienceDirect articles
        this.urlPatterns = [
            // PII-based URLs (most common)
            /sciencedirect\.com\/science\/article\/pii\/([A-Z0-9]+)/i,
            /sciencedirect\.com\/science\/article\/abs\/pii\/([A-Z0-9]+)/i,
            // Book chapters
            /sciencedirect\.com\/science\/book\/([A-Z0-9]+)/i,
            // DOI-based URLs
            /sciencedirect\.com\/science\/article\/doi\/(10\.\d+\/[^\s?#]+)/i,
            // Generic article URLs
            /sciencedirect\.com\/science\/article\//,
            // PDF direct links
            /sciencedirect\.com\/\S+\.pdf/i,
            // Reader view
            /reader\.elsevier\.com\/reader\/sd\/pii\/([A-Z0-9]+)/i,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /sciencedirect\.com\/science\/article\//.test(url) ||
            /sciencedirect\.com\/science\/book\//.test(url) ||
            /reader\.elsevier\.com\/reader\/sd\/pii\//.test(url);
    }
    /**
     * Extract paper ID (PII) from URL
     */
    extractPaperId(url) {
        // Try PII format (most common)
        const piiMatch = url.match(/pii\/([A-Z0-9]+)/i);
        if (piiMatch) {
            return piiMatch[1];
        }
        // Try DOI format
        const doiMatch = url.match(/doi\/(10\.\d+\/[^\s?#]+)/i);
        if (doiMatch) {
            return doiMatch[1];
        }
        // Try book format
        const bookMatch = url.match(/book\/([A-Z0-9]+)/i);
        if (bookMatch) {
            return bookMatch[1];
        }
        return null;
    }
    /**
     * Create custom metadata extractor for ScienceDirect
     */
    createMetadataExtractor(document) {
        return new ScienceDirectMetadataExtractor(document);
    }
}
// Export singleton instance
const scienceDirectIntegration = new ScienceDirectIntegration();

// extension/source-integration/springer/index.ts
loguru.getLogger('springer-integration');
/**
 * Custom metadata extractor for Springer pages
 */
class SpringerMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]') ||
            this.getMetaContent('meta[name="dc.title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        // Fallback to DC creator
        const dcCreators = [];
        this.document.querySelectorAll('meta[name="dc.creator"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                dcCreators.push(content);
        });
        if (dcCreators.length > 0) {
            return dcCreators.join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="dc.description"]') ||
            this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_online_date"]') ||
            this.getMetaContent('meta[name="dc.date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract DOI
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') ||
            this.getMetaContent('meta[name="dc.identifier"]') ||
            super.extractDoi();
    }
    /**
     * Extract journal name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_journal_title"]') ||
            this.getMetaContent('meta[name="citation_conference_title"]') ||
            this.getMetaContent('meta[name="prism.publicationName"]') ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * Springer integration for Springer Link articles
 */
class SpringerIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'springer';
        this.name = 'Springer';
        // URL patterns for Springer articles and chapters
        this.urlPatterns = [
            // Articles with DOI
            /link\.springer\.com\/article\/(10\.\d+\/[^\s?#]+)/,
            // Book chapters with DOI
            /link\.springer\.com\/chapter\/(10\.\d+\/[^\s?#]+)/,
            // Books
            /link\.springer\.com\/book\/(10\.\d+\/[^\s?#]+)/,
            // Conference papers
            /link\.springer\.com\/content\/pdf\/(10\.\d+\/[^\s?#]+)/,
            // Proceedings
            /link\.springer\.com\/proceeding\/(10\.\d+\/[^\s?#]+)/,
            // Reference work entries
            /link\.springer\.com\/referenceworkentry\/(10\.\d+\/[^\s?#]+)/,
            // PDF variants
            /link\.springer\.com\/content\/pdf\/(10\.\d+%2F[^\s?#]+)/,
            // EPUB variants
            /link\.springer\.com\/epub\/(10\.\d+\/[^\s?#]+)/,
            // Generic patterns for matching
            /link\.springer\.com\/article\//,
            /link\.springer\.com\/chapter\//,
            /link\.springer\.com\/book\//,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /link\.springer\.com\/(article|chapter|book|content|proceeding|referenceworkentry|epub)\//.test(url);
    }
    /**
     * Extract paper ID (DOI) from URL
     */
    extractPaperId(url) {
        // Try to extract DOI from URL path
        const doiMatch = url.match(/link\.springer\.com\/(?:article|chapter|book|content\/pdf|proceeding|referenceworkentry|epub)\/(10\.\d+[/%][^\s?#]+)/);
        if (doiMatch) {
            // Decode URL-encoded DOIs
            return decodeURIComponent(doiMatch[1]).replace(/%2F/gi, '/');
        }
        return null;
    }
    /**
     * Create custom metadata extractor for Springer
     */
    createMetadataExtractor(document) {
        return new SpringerMetadataExtractor(document);
    }
}
// Export singleton instance
const springerIntegration = new SpringerIntegration();

// extension/source-integration/ieee/index.ts
loguru.getLogger('ieee-integration');
/**
 * Custom metadata extractor for IEEE Xplore pages
 */
class IEEEMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        // Fallback to HTML extraction
        const authorElements = this.document.querySelectorAll('.authors-info .author span');
        if (authorElements.length > 0) {
            return Array.from(authorElements)
                .map(el => el.textContent?.trim())
                .filter(Boolean)
                .join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        // IEEE often has abstract in a specific div
        if (!metaDescription) {
            const abstractDiv = this.document.querySelector('.abstract-text');
            if (abstractDiv) {
                return abstractDiv.textContent?.trim() || '';
            }
        }
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_date"]') ||
            this.getMetaContent('meta[name="citation_online_date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract DOI
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') || super.extractDoi();
    }
    /**
     * Extract journal/conference name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_journal_title"]') ||
            this.getMetaContent('meta[name="citation_conference_title"]') ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        // IEEE-specific keyword extraction from HTML
        const keywordElements = this.document.querySelectorAll('.keywords .keyword');
        if (keywordElements.length > 0) {
            return Array.from(keywordElements)
                .map(el => el.textContent?.trim())
                .filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * IEEE Xplore integration
 */
class IEEEIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'ieee';
        this.name = 'IEEE Xplore';
        // URL patterns for IEEE articles
        this.urlPatterns = [
            // Standard document URLs
            /ieeexplore\.ieee\.org\/document\/(\d+)/,
            /ieeexplore\.ieee\.org\/abstract\/document\/(\d+)/,
            // Stamp (full text) URLs
            /ieeexplore\.ieee\.org\/stamp\/stamp\.jsp\?.*arnumber=(\d+)/,
            // PDF direct links
            /ieeexplore\.ieee\.org\/ielx?\d*\/\d+\/\d+\/(\d+)\.pdf/,
            // XPL URLs (older format)
            /ieeexplore\.ieee\.org\/xpl\/articleDetails\.jsp\?arnumber=(\d+)/,
            /ieeexplore\.ieee\.org\/xpl\/tocresult\.jsp/,
            // Course/content URLs
            /ieeexplore\.ieee\.org\/courses\/details\/(\d+)/,
            // IEEE Computer Society
            /computer\.org\/csdl\/\w+\/\d+\/\d+\/(\d+)/,
            // Generic document pattern
            /ieeexplore\.ieee\.org\/document\//,
            /ieeexplore\.ieee\.org\/abstract\/document\//,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /ieeexplore\.ieee\.org\/(document|abstract|stamp|ielx?\d*|xpl)\//.test(url) ||
            /computer\.org\/csdl\//.test(url);
    }
    /**
     * Extract paper ID (document number) from URL
     */
    extractPaperId(url) {
        // Try document/abstract URL
        const docMatch = url.match(/document\/(\d+)/);
        if (docMatch) {
            return docMatch[1];
        }
        // Try arnumber parameter
        const arnumberMatch = url.match(/arnumber=(\d+)/);
        if (arnumberMatch) {
            return arnumberMatch[1];
        }
        // Try PDF URL format
        const pdfMatch = url.match(/\/(\d+)\.pdf/);
        if (pdfMatch) {
            return pdfMatch[1];
        }
        // Try IEEE Computer Society format
        const csdlMatch = url.match(/csdl\/\w+\/\d+\/\d+\/(\d+)/);
        if (csdlMatch) {
            return csdlMatch[1];
        }
        return null;
    }
    /**
     * Create custom metadata extractor for IEEE
     */
    createMetadataExtractor(document) {
        return new IEEEMetadataExtractor(document);
    }
}
// Export singleton instance
const ieeeIntegration = new IEEEIntegration();

// extension/source-integration/acm/index.ts
loguru.getLogger('acm-integration');
/**
 * Custom metadata extractor for ACM DL pages
 */
class ACMMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]') ||
            this.getMetaContent('meta[name="dc.Title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_date"]') ||
            this.getMetaContent('meta[name="dc.Date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract DOI
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') ||
            this.getMetaContent('meta[name="dc.Identifier"]') ||
            super.extractDoi();
    }
    /**
     * Extract journal/conference name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_journal_title"]') ||
            this.getMetaContent('meta[name="citation_conference_title"]') ||
            this.getMetaContent('meta[name="dc.Source"]') ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * ACM Digital Library integration
 */
class ACMIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'acm';
        this.name = 'ACM Digital Library';
        // URL patterns for ACM articles
        this.urlPatterns = [
            // Standard DOI URLs (handles various DOI formats including alphanumeric)
            /dl\.acm\.org\/doi\/(10\.\d+\/[^\s?#]+)/,
            /dl\.acm\.org\/doi\/abs\/(10\.\d+\/[^\s?#]+)/,
            /dl\.acm\.org\/doi\/full\/(10\.\d+\/[^\s?#]+)/,
            /dl\.acm\.org\/doi\/pdf\/(10\.\d+\/[^\s?#]+)/,
            /dl\.acm\.org\/doi\/epdf\/(10\.\d+\/[^\s?#]+)/,
            // Legacy citation URLs
            /dl\.acm\.org\/citation\.cfm\?id=(\d+)/,
            /dl\.acm\.org\/citation\.cfm\?.*doid=[\d.]+\.(\d+)/,
            // Proceeding URLs
            /dl\.acm\.org\/doi\/proceedings\/(10\.\d+\/[^\s?#]+)/,
            // Book chapters
            /dl\.acm\.org\/doi\/book\/(10\.\d+\/[^\s?#]+)/,
            // Generic ACM DL pattern
            /dl\.acm\.org\/doi\//,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /dl\.acm\.org\/(doi|citation)/.test(url);
    }
    /**
     * Extract paper ID (DOI or citation ID) from URL
     */
    extractPaperId(url) {
        // Try DOI format (most common, handles alphanumeric DOIs)
        const doiMatch = url.match(/dl\.acm\.org\/doi\/(?:abs|full|pdf|epdf|proceedings|book)?\/?((10\.\d+\/[^\s?#]+))/);
        if (doiMatch) {
            return doiMatch[2] || doiMatch[1];
        }
        // Try legacy citation.cfm format
        const legacyMatch = url.match(/citation\.cfm\?.*id=(\d+)/);
        if (legacyMatch) {
            return legacyMatch[1];
        }
        // Try doid format
        const doidMatch = url.match(/doid=[\d.]+\.(\d+)/);
        if (doidMatch) {
            return doidMatch[1];
        }
        return null;
    }
    /**
     * Create custom metadata extractor for ACM
     */
    createMetadataExtractor(document) {
        return new ACMMetadataExtractor(document);
    }
}
// Export singleton instance
const acmIntegration = new ACMIntegration();

// extension/source-integration/acl/index.ts
loguru.getLogger('acl-integration');
/**
 * Custom metadata extractor for ACL Anthology pages
 */
class ACLMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="citation_abstract"]') ||
            this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract DOI
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') || super.extractDoi();
    }
    /**
     * Extract conference name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_conference_title"]') ||
            this.getMetaContent('meta[name="citation_journal_title"]') ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * ACL Anthology integration for computational linguistics papers
 */
class ACLIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'acl';
        this.name = 'ACL Anthology';
        // URL patterns for ACL Anthology papers (various formats)
        this.urlPatterns = [
            // Current ACL Anthology format (e.g., 2023.acl-main.1)
            /aclanthology\.org\/([A-Z0-9]+\.\d+-[a-z]+-\d+)/i,
            /aclanthology\.org\/([A-Z0-9]+\.\d+-\d+)/,
            // Older ACL Anthology format (e.g., P18-1001)
            /aclanthology\.org\/([A-Z]\d{2}-\d+)/,
            // Legacy aclweb.org URLs
            /aclweb\.org\/anthology\/([A-Z0-9]+\.\d+-\d+)/,
            /aclweb\.org\/anthology\/([A-Z]\d{2}-\d+)/,
            // PDF variants
            /aclanthology\.org\/([^\/]+)\.pdf/,
            // Volumes
            /aclanthology\.org\/volumes\/([^\/\s?#]+)/,
            // Generic ACL patterns
            /aclanthology\.org\/[A-Z0-9]/i,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /aclanthology\.org\/[A-Z0-9]/i.test(url) ||
            /aclweb\.org\/anthology\//.test(url);
    }
    /**
     * Extract paper ID from URL
     */
    extractPaperId(url) {
        // Try new format (e.g., 2023.acl-main.1)
        const newFormatMatch = url.match(/aclanthology\.org\/([A-Z0-9]+\.[a-z0-9-]+)/i);
        if (newFormatMatch) {
            return newFormatMatch[1].replace(/\.pdf$/, '');
        }
        // Try old format (e.g., P18-1001)
        const oldFormatMatch = url.match(/(?:aclanthology|aclweb)\.org\/(?:anthology\/)?([A-Z]\d{2}-\d+)/);
        if (oldFormatMatch) {
            return oldFormatMatch[1];
        }
        // Try volume format
        const volumeMatch = url.match(/volumes\/([^\/\s?#]+)/);
        if (volumeMatch) {
            return volumeMatch[1];
        }
        return null;
    }
    /**
     * Create custom metadata extractor for ACL
     */
    createMetadataExtractor(document) {
        return new ACLMetadataExtractor(document);
    }
}
// Export singleton instance
const aclIntegration = new ACLIntegration();

// extension/source-integration/neurips/index.ts
loguru.getLogger('neurips-integration');
/**
 * Custom metadata extractor for NeurIPS pages
 */
class NeurIPSMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        // Fallback to HTML extraction
        const authorElements = this.document.querySelectorAll('.author a, .author span');
        if (authorElements.length > 0) {
            return Array.from(authorElements)
                .map(el => el.textContent?.trim())
                .filter(Boolean)
                .join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="citation_abstract"]') ||
            this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        // NeurIPS often has abstract in a specific section
        if (!metaDescription) {
            const abstractSection = this.document.querySelector('.abstract');
            if (abstractSection) {
                return abstractSection.textContent?.trim() || '';
            }
        }
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract conference name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_conference_title"]') ||
            'NeurIPS' ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * NeurIPS proceedings integration
 */
class NeurIPSIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'neurips';
        this.name = 'NeurIPS';
        // URL patterns for NeurIPS papers (multiple domains and formats)
        this.urlPatterns = [
            // proceedings.neurips.cc (current main site)
            /proceedings\.neurips\.cc\/paper\/(\d+)\/hash\/([a-f0-9]+)/,
            /proceedings\.neurips\.cc\/paper\/(\d+)\/file\/([a-f0-9]+)/,
            /proceedings\.neurips\.cc\/paper_files\/paper\/(\d+)\/hash\/([a-f0-9]+)/,
            /proceedings\.neurips\.cc\/paper_files\/paper\/(\d+)\/file\/([a-f0-9]+)/,
            // papers.nips.cc (legacy domain)
            /papers\.nips\.cc\/paper\/(\d+)\/hash\/([a-f0-9]+)/,
            /papers\.nips\.cc\/paper\/(\d+)\/file\/([a-f0-9]+)/,
            /papers\.nips\.cc\/paper_files\/paper\/(\d+)\/hash\/([a-f0-9]+)/,
            // Title-based URLs (older format)
            /papers\.nips\.cc\/paper\/(\d+)-([^\/\s]+)/,
            /proceedings\.neurips\.cc\/paper\/(\d+)-([^\/\s]+)/,
            // Generic NeurIPS paper patterns
            /proceedings\.neurips\.cc\/paper/,
            /papers\.nips\.cc\/paper/,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /proceedings\.neurips\.cc\/paper/.test(url) ||
            /papers\.nips\.cc\/paper/.test(url);
    }
    /**
     * Extract paper ID from URL
     */
    extractPaperId(url) {
        // Try hash/file format (current)
        const hashMatch = url.match(/paper(?:_files)?\/paper\/(\d+)\/(?:hash|file)\/([a-f0-9]+)/);
        if (hashMatch) {
            return `${hashMatch[1]}-${hashMatch[2]}`;
        }
        // Try title-based format (older)
        const titleMatch = url.match(/paper\/(\d+)-([^\/\s.]+)/);
        if (titleMatch) {
            return `${titleMatch[1]}-${titleMatch[2]}`;
        }
        // Try just year + anything
        const yearMatch = url.match(/paper(?:_files)?\/paper\/(\d+)\/([^\/\s]+)/);
        if (yearMatch) {
            return `${yearMatch[1]}-${yearMatch[2]}`;
        }
        return null;
    }
    /**
     * Create custom metadata extractor for NeurIPS
     */
    createMetadataExtractor(document) {
        return new NeurIPSMetadataExtractor(document);
    }
}
// Export singleton instance
const neuripsIntegration = new NeurIPSIntegration();

// extension/source-integration/cvf/index.ts
loguru.getLogger('cvf-integration');
/**
 * Custom metadata extractor for CVF pages
 */
class CVFMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        // Fallback to HTML extraction
        const authorElements = this.document.querySelectorAll('.author a, #authors b');
        if (authorElements.length > 0) {
            return Array.from(authorElements)
                .map(el => el.textContent?.trim())
                .filter(Boolean)
                .join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="citation_abstract"]') ||
            this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        // CVF has abstract in a specific div
        if (!metaDescription) {
            const abstractDiv = this.document.querySelector('#abstract');
            if (abstractDiv) {
                return abstractDiv.textContent?.trim() || '';
            }
        }
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract conference name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_conference_title"]') ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * CVF Open Access integration for CVPR, ICCV, WACV
 */
class CVFIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'cvf';
        this.name = 'CVF Open Access';
        // URL patterns for CVF papers (CVPR, ICCV, WACV, etc.)
        this.urlPatterns = [
            // HTML paper pages
            /openaccess\.thecvf\.com\/content[_\/]([A-Z]+)[_\/](\d+)[_\/]html[_\/]([^.]+)\.html/i,
            /openaccess\.thecvf\.com\/content\/([A-Z]+)(\d+)[_\/]html[_\/]([^.]+)\.html/i,
            // PDF papers
            /openaccess\.thecvf\.com\/content[_\/]([A-Z]+)[_\/](\d+)[_\/]papers[_\/]([^.]+)\.pdf/i,
            /openaccess\.thecvf\.com\/content\/([A-Z]+)(\d+)[_\/]papers[_\/]([^.]+)\.pdf/i,
            // Workshop papers
            /openaccess\.thecvf\.com\/content[_\/]([A-Z]+)[_\/](\d+)[_\/]W\d+[_\/]html[_\/]([^.]+)\.html/i,
            /openaccess\.thecvf\.com\/content[_\/]([A-Z]+)[_\/](\d+)[_\/]W\d+[_\/]papers[_\/]([^.]+)\.pdf/i,
            // Supplementary materials
            /openaccess\.thecvf\.com\/content[_\/]([A-Z]+)[_\/](\d+)[_\/]supplemental[_\/]([^.]+)/i,
            // Generic CVF content pattern
            /openaccess\.thecvf\.com\/content/,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /openaccess\.thecvf\.com\/content/.test(url);
    }
    /**
     * Extract paper ID from URL
     */
    extractPaperId(url) {
        // Try to extract conference, year, and paper name from various formats
        // Format 1: content_CONF_YEAR/html/paper.html
        const format1 = url.match(/content[_\/]([A-Z]+)[_\/](\d+)[_\/](?:W\d+[_\/])?(?:html|papers)[_\/]([^.\/]+)/i);
        if (format1) {
            return `${format1[1]}-${format1[2]}-${format1[3]}`;
        }
        // Format 2: content/CONFYEAR/html/paper.html
        const format2 = url.match(/content\/([A-Z]+)(\d{4})[_\/](?:W\d+[_\/])?(?:html|papers)[_\/]([^.\/]+)/i);
        if (format2) {
            return `${format2[1]}-${format2[2]}-${format2[3]}`;
        }
        // Fallback: just extract the paper name from the path
        const fallback = url.match(/\/([^\/]+)\.(?:html|pdf)$/);
        if (fallback) {
            return fallback[1];
        }
        return null;
    }
    /**
     * Create custom metadata extractor for CVF
     */
    createMetadataExtractor(document) {
        return new CVFMetadataExtractor(document);
    }
}
// Export singleton instance
const cvfIntegration = new CVFIntegration();

// extension/source-integration/wiley/index.ts
loguru.getLogger('wiley-integration');
/**
 * Custom metadata extractor for Wiley pages
 */
class WileyMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]') ||
            this.getMetaContent('meta[name="dc.Title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_online_date"]') ||
            this.getMetaContent('meta[name="dc.Date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract DOI
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') ||
            this.getMetaContent('meta[name="dc.Identifier"]') ||
            super.extractDoi();
    }
    /**
     * Extract journal name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_journal_title"]') ||
            this.getMetaContent('meta[name="dc.Source"]') ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * Wiley Online Library integration
 */
class WileyIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'wiley';
        this.name = 'Wiley Online Library';
        // URL patterns for Wiley articles
        this.urlPatterns = [
            // Standard DOI URLs
            /onlinelibrary\.wiley\.com\/doi\/(10\.\d+\/[^\s?#]+)/,
            /onlinelibrary\.wiley\.com\/doi\/abs\/(10\.\d+\/[^\s?#]+)/,
            /onlinelibrary\.wiley\.com\/doi\/full\/(10\.\d+\/[^\s?#]+)/,
            /onlinelibrary\.wiley\.com\/doi\/pdf\/(10\.\d+\/[^\s?#]+)/,
            /onlinelibrary\.wiley\.com\/doi\/epdf\/(10\.\d+\/[^\s?#]+)/,
            // Wiley society journals (e.g., physoc.onlinelibrary.wiley.com)
            /\w+\.onlinelibrary\.wiley\.com\/doi\/(10\.\d+\/[^\s?#]+)/,
            /\w+\.onlinelibrary\.wiley\.com\/doi\/abs\/(10\.\d+\/[^\s?#]+)/,
            /\w+\.onlinelibrary\.wiley\.com\/doi\/full\/(10\.\d+\/[^\s?#]+)/,
            // AGU Publications (agupubs)
            /agupubs\.onlinelibrary\.wiley\.com\/doi\/(10\.\d+\/[^\s?#]+)/,
            // FEBS journals
            /febs\.onlinelibrary\.wiley\.com\/doi\/(10\.\d+\/[^\s?#]+)/,
            // Generic Wiley DOI pattern
            /onlinelibrary\.wiley\.com\/doi\//,
            /\.onlinelibrary\.wiley\.com\/doi\//,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /\.?onlinelibrary\.wiley\.com\/doi\//.test(url);
    }
    /**
     * Extract paper ID (DOI) from URL
     */
    extractPaperId(url) {
        // Try to extract DOI from URL path (handles all variants)
        const doiMatch = url.match(/\/doi\/(?:abs|full|pdf|epdf)?\/?((10\.\d+\/[^\s?#]+))/);
        if (doiMatch) {
            return doiMatch[2] || doiMatch[1];
        }
        return null;
    }
    /**
     * Create custom metadata extractor for Wiley
     */
    createMetadataExtractor(document) {
        return new WileyMetadataExtractor(document);
    }
}
// Export singleton instance
const wileyIntegration = new WileyIntegration();

// extension/source-integration/plos/index.ts
loguru.getLogger('plos-integration');
/**
 * Custom metadata extractor for PLOS pages
 */
class PLOSMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]') ||
            this.getMetaContent('meta[name="dc.title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_date"]') ||
            this.getMetaContent('meta[name="dc.date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract DOI
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') ||
            this.getMetaContent('meta[name="dc.identifier"]') ||
            super.extractDoi();
    }
    /**
     * Extract journal name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_journal_title"]') ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * PLOS (Public Library of Science) integration
 */
class PLOSIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'plos';
        this.name = 'PLOS';
        // URL patterns for PLOS articles (all PLOS journals)
        this.urlPatterns = [
            // Standard article URLs with DOI parameter
            /journals\.plos\.org\/\w+\/article\?id=(10\.\d+\/[^\s&]+)/,
            // URL encoded DOI format
            /journals\.plos\.org\/\w+\/article\/info[:%]3Adoi[/%]2F(10\.\d+)/,
            // Generic PLOS article URL (for canHandleUrl)
            /journals\.plos\.org\/\w+\/article/,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /journals\.plos\.org\/\w+\/article/.test(url);
    }
    /**
     * Extract paper ID (DOI) from URL
     */
    extractPaperId(url) {
        // Try to extract DOI from id parameter
        const idMatch = url.match(/[?&]id=(10\.\d+\/[^\s&]+)/);
        if (idMatch) {
            return decodeURIComponent(idMatch[1]);
        }
        // Try URL encoded DOI format
        const encodedMatch = url.match(/doi[/%]2F(10\.\d+[/%]2F[^\s&]+)/i);
        if (encodedMatch) {
            return decodeURIComponent(encodedMatch[1].replace(/%2F/gi, '/'));
        }
        // Fallback: generate from URL
        return null;
    }
    /**
     * Create custom metadata extractor for PLOS
     */
    createMetadataExtractor(document) {
        return new PLOSMetadataExtractor(document);
    }
}
// Export singleton instance
const plosIntegration = new PLOSIntegration();

// extension/source-integration/biorxiv/index.ts
loguru.getLogger('biorxiv-integration');
/**
 * Custom metadata extractor for bioRxiv pages
 */
class BioRxivMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]') ||
            this.getMetaContent('meta[name="DC.Title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="citation_abstract"]') ||
            this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_online_date"]') ||
            this.getMetaContent('meta[name="DC.Date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract DOI
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') ||
            this.getMetaContent('meta[name="DC.Identifier"]') ||
            super.extractDoi();
    }
    /**
     * Extract journal/venue name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_journal_title"]') ||
            'bioRxiv' ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * bioRxiv integration for preprints in biology
 */
class BioRxivIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'biorxiv';
        this.name = 'bioRxiv';
        // URL patterns for bioRxiv preprints
        this.urlPatterns = [
            // DOI-based content URLs (most common)
            /biorxiv\.org\/content\/(10\.\d+\/[^\s?#]+)/,
            // Early preprint URLs (legacy format)
            /biorxiv\.org\/content\/early\/\d+\/\d+\/\d+\/(\d+)/,
            // Full/abs/pdf variants
            /biorxiv\.org\/content\/(10\.\d+\/[^\s?#]+)\.full/,
            /biorxiv\.org\/content\/(10\.\d+\/[^\s?#]+)\.abstract/,
            /biorxiv\.org\/content\/(10\.\d+\/[^\s?#]+)\.pdf/,
            // Collection URLs
            /biorxiv\.org\/cgi\/content\/full\/(\d+)/,
            /biorxiv\.org\/cgi\/content\/abstract\/(\d+)/,
            // Generic content pattern
            /biorxiv\.org\/content\//,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /biorxiv\.org\/(content|cgi\/content)\//.test(url);
    }
    /**
     * Extract paper ID (DOI or early ID) from URL
     */
    extractPaperId(url) {
        // Try DOI format (remove version suffix like v1, v2, etc.)
        const doiMatch = url.match(/biorxiv\.org\/content\/(10\.\d+\/[^\s?#.]+)/);
        if (doiMatch) {
            return doiMatch[1].replace(/v\d+$/, '');
        }
        // Try early format
        const earlyMatch = url.match(/early\/\d+\/\d+\/\d+\/(\d+)/);
        if (earlyMatch) {
            return earlyMatch[1];
        }
        // Try cgi format
        const cgiMatch = url.match(/cgi\/content\/(?:full|abstract)\/(\d+)/);
        if (cgiMatch) {
            return cgiMatch[1];
        }
        return null;
    }
    /**
     * Create custom metadata extractor for bioRxiv
     */
    createMetadataExtractor(document) {
        return new BioRxivMetadataExtractor(document);
    }
}
// Export singleton instance
const bioRxivIntegration = new BioRxivIntegration();

// extension/source-integration/medrxiv/index.ts
loguru.getLogger('medrxiv-integration');
/**
 * Custom metadata extractor for medRxiv pages
 */
class MedRxivMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]') ||
            this.getMetaContent('meta[name="DC.Title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="citation_abstract"]') ||
            this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_online_date"]') ||
            this.getMetaContent('meta[name="DC.Date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract DOI
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') ||
            this.getMetaContent('meta[name="DC.Identifier"]') ||
            super.extractDoi();
    }
    /**
     * Extract journal/venue name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_journal_title"]') ||
            'medRxiv' ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * medRxiv integration for medical preprints
 */
class MedRxivIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'medrxiv';
        this.name = 'medRxiv';
        // URL patterns for medRxiv preprints
        this.urlPatterns = [
            // DOI-based content URLs (most common)
            /medrxiv\.org\/content\/(10\.\d+\/[^\s?#]+)/,
            // Early preprint URLs (legacy format)
            /medrxiv\.org\/content\/early\/\d+\/\d+\/\d+\/(\d+)/,
            // Full/abs/pdf variants
            /medrxiv\.org\/content\/(10\.\d+\/[^\s?#]+)\.full/,
            /medrxiv\.org\/content\/(10\.\d+\/[^\s?#]+)\.abstract/,
            /medrxiv\.org\/content\/(10\.\d+\/[^\s?#]+)\.pdf/,
            // Collection URLs
            /medrxiv\.org\/cgi\/content\/full\/(\d+)/,
            /medrxiv\.org\/cgi\/content\/abstract\/(\d+)/,
            // Generic content pattern
            /medrxiv\.org\/content\//,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /medrxiv\.org\/(content|cgi\/content)\//.test(url);
    }
    /**
     * Extract paper ID (DOI or early ID) from URL
     */
    extractPaperId(url) {
        // Try DOI format (remove version suffix like v1, v2, etc.)
        const doiMatch = url.match(/medrxiv\.org\/content\/(10\.\d+\/[^\s?#.]+)/);
        if (doiMatch) {
            return doiMatch[1].replace(/v\d+$/, '');
        }
        // Try early format
        const earlyMatch = url.match(/early\/\d+\/\d+\/\d+\/(\d+)/);
        if (earlyMatch) {
            return earlyMatch[1];
        }
        // Try cgi format
        const cgiMatch = url.match(/cgi\/content\/(?:full|abstract)\/(\d+)/);
        if (cgiMatch) {
            return cgiMatch[1];
        }
        return null;
    }
    /**
     * Create custom metadata extractor for medRxiv
     */
    createMetadataExtractor(document) {
        return new MedRxivMetadataExtractor(document);
    }
}
// Export singleton instance
const medRxivIntegration = new MedRxivIntegration();

// extension/source-integration/ssrn/index.ts
loguru.getLogger('ssrn-integration');
/**
 * Custom metadata extractor for SSRN pages
 */
class SSRNMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_date"]') ||
            this.getMetaContent('meta[name="citation_online_date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract DOI if available
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') || super.extractDoi();
    }
    /**
     * Extract journal/series name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_journal_title"]') ||
            'SSRN' ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * SSRN (Social Science Research Network) integration
 */
class SSRNIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'ssrn';
        this.name = 'SSRN';
        // URL patterns for SSRN papers
        this.urlPatterns = [
            // Short URL format
            /ssrn\.com\/abstract=(\d+)/,
            // Legacy sol3/papers.cfm format
            /papers\.ssrn\.com\/sol3\/papers\.cfm\?abstract_id=(\d+)/,
            /papers\.ssrn\.com\/sol3\/papers\.cfm\?.*abstract_id=(\d+)/,
            // Delivery format
            /papers\.ssrn\.com\/sol3\/Delivery\.cfm.*abstractid=(\d+)/i,
            // Direct link format
            /ssrn\.com\/(\d{7,})/,
            // DOI format
            /dx\.doi\.org\/10\.2139\/ssrn\.(\d+)/,
            // Generic SSRN patterns
            /ssrn\.com\/abstract/,
            /papers\.ssrn\.com\/sol3\//,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /ssrn\.com\/(abstract|sol3|\d{7})/.test(url) ||
            /papers\.ssrn\.com\/sol3\//.test(url) ||
            /doi\.org\/10\.2139\/ssrn/.test(url);
    }
    /**
     * Extract paper ID from URL
     */
    extractPaperId(url) {
        // Try abstract= format
        const abstractMatch = url.match(/abstract[=_]?(\d+)/i);
        if (abstractMatch) {
            return abstractMatch[1];
        }
        // Try abstract_id= format
        const abstractIdMatch = url.match(/abstract_id=(\d+)/i);
        if (abstractIdMatch) {
            return abstractIdMatch[1];
        }
        // Try DOI format
        const doiMatch = url.match(/10\.2139\/ssrn\.(\d+)/);
        if (doiMatch) {
            return doiMatch[1];
        }
        // Try direct numeric ID in URL path
        const directMatch = url.match(/ssrn\.com\/(\d{7,})/);
        if (directMatch) {
            return directMatch[1];
        }
        return null;
    }
    /**
     * Create custom metadata extractor for SSRN
     */
    createMetadataExtractor(document) {
        return new SSRNMetadataExtractor(document);
    }
}
// Export singleton instance
const ssrnIntegration = new SSRNIntegration();

// extension/source-integration/semanticscholar/index.ts
loguru.getLogger('semanticscholar-integration');
/**
 * Custom metadata extractor for Semantic Scholar pages
 */
class SemanticScholarMetadataExtractor extends MetadataExtractor {
    /**
     * Extract title using citation meta tags
     */
    extractTitle() {
        const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
            this.getMetaContent('meta[property="og:title"]');
        return metaTitle || super.extractTitle();
    }
    /**
     * Extract authors from citation meta tags
     */
    extractAuthors() {
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        return super.extractAuthors();
    }
    /**
     * Extract abstract/description
     */
    extractDescription() {
        const metaDescription = this.getMetaContent('meta[name="description"]') ||
            this.getMetaContent('meta[property="og:description"]');
        return metaDescription || super.extractDescription();
    }
    /**
     * Extract publication date
     */
    extractPublishedDate() {
        return this.getMetaContent('meta[name="citation_publication_date"]') ||
            this.getMetaContent('meta[name="citation_date"]') ||
            super.extractPublishedDate();
    }
    /**
     * Extract DOI if available
     */
    extractDoi() {
        return this.getMetaContent('meta[name="citation_doi"]') || super.extractDoi();
    }
    /**
     * Extract journal/venue name
     */
    extractJournalName() {
        return this.getMetaContent('meta[name="citation_journal_title"]') ||
            this.getMetaContent('meta[name="citation_conference_title"]') ||
            super.extractJournalName();
    }
    /**
     * Extract keywords/tags
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
            this.getMetaContent('meta[name="keywords"]');
        if (keywords) {
            return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
        }
        return super.extractTags();
    }
}
/**
 * Semantic Scholar integration
 */
class SemanticScholarIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'semanticscholar';
        this.name = 'Semantic Scholar';
        // URL patterns for Semantic Scholar papers
        this.urlPatterns = [
            // Standard paper URL with title slug and corpus ID
            /semanticscholar\.org\/paper\/[^/]+\/([a-f0-9]+)/,
            // Paper URL without title slug (direct ID)
            /semanticscholar\.org\/paper\/([a-f0-9]{40})/,
            // CorpusID-based URL
            /semanticscholar\.org\/paper\/[^?]*[?&]corpusId=(\d+)/,
            // Reader URL
            /semanticscholar\.org\/reader\/([a-f0-9]+)/,
            // Author paper pages
            /semanticscholar\.org\/author\/[^/]+\/papers/,
            // Generic paper pattern
            /semanticscholar\.org\/paper\//,
        ];
    }
    /**
     * Check if this integration can handle the given URL
     */
    canHandleUrl(url) {
        return /semanticscholar\.org\/(paper|reader)\//.test(url);
    }
    /**
     * Extract paper ID from URL
     */
    extractPaperId(url) {
        // Try to extract 40-character hex ID (SHA)
        const shaMatch = url.match(/\/([a-f0-9]{40})/);
        if (shaMatch) {
            return shaMatch[1];
        }
        // Try corpus ID from query params
        const corpusMatch = url.match(/[?&]corpusId=(\d+)/);
        if (corpusMatch) {
            return `corpus:${corpusMatch[1]}`;
        }
        // Try shorter hex ID format
        const shortIdMatch = url.match(/semanticscholar\.org\/(?:paper|reader)\/[^/]*\/([a-f0-9]+)/);
        if (shortIdMatch) {
            return shortIdMatch[1];
        }
        return null;
    }
    /**
     * Create custom metadata extractor for Semantic Scholar
     */
    createMetadataExtractor(document) {
        return new SemanticScholarMetadataExtractor(document);
    }
}
// Export singleton instance
const semanticScholarIntegration = new SemanticScholarIntegration();

// extension/source-integration/misc/index.ts
class MiscIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'url-misc';
        this.name = 'misc tracked url';
        // URL patterns for link detection - these enable the annotation icon on matching links
        this.urlPatterns = [
            // ScienceDirect
            /sciencedirect\.com\/science\/article\//,
            // PhilPapers
            /philpapers\.org\/rec\//,
            // NeurIPS proceedings
            /proceedings\.neurips\.cc\/paper_files\/paper\//,
            /papers\.nips\.cc\/paper_files\/paper\//,
            // Sage Journals
            /journals\.sagepub\.com\/doi\//,
            // Springer Link
            /link\.springer\.com\/article\//,
            // Science.org
            /science\.org\/doi\//,
            // APS Journals
            /journals\.aps\.org\/\w+\/abstract\//,
            // Wiley
            /onlinelibrary\.wiley\.com\/doi\//,
            /physoc\.onlinelibrary\.wiley\.com\/doi\//,
            // Cell Press
            /cell\.com\/.*\/fulltext\//,
            // ResearchGate
            /researchgate\.net\/publication\//,
            // APA PsycNET
            /psycnet\.apa\.org\/record\//,
            // bioRxiv/medRxiv
            /biorxiv\.org\/content\//,
            /medrxiv\.org\/content\//,
            // OSF Preprints
            /osf\.io\/preprints\//,
            // Frontiers
            /frontiersin\.org\/journals?\//,
            /frontiersin\.org\/articles?\//,
            // JSTOR
            /jstor\.org\/stable\//,
            // PMLR (Proceedings of Machine Learning Research)
            /proceedings\.mlr\.press\//,
            // PLOS
            /journals\.plos\.org\/\w+\/article/,
            // IEEE Xplore
            /ieeexplore\.ieee\.org\/document\//,
            /ieeexplore\.ieee\.org\/abstract\/document\//,
            // Royal Society
            /royalsocietypublishing\.org\/doi\//,
            // PhilArchive
            /philarchive\.org\/archive\//,
            // Taylor & Francis
            /tandfonline\.com\/doi\//,
            // IOP Science
            /iopscience\.iop\.org\/article\//,
            // Oxford Academic
            /academic\.oup\.com\/\w+\/article/,
            // eLife
            /elifesciences\.org\/articles\//,
            // eScholarship
            /escholarship\.org\/content\//,
            // PubMed Central
            /pmc\.ncbi\.nlm\.nih\.gov\/articles\//,
            /ncbi\.nlm\.nih\.gov\/pmc\/articles\//,
            // PubMed
            /pubmed\.ncbi\.nlm\.nih\.gov\/\d+/,
            // CVF Open Access
            /openaccess\.thecvf\.com\/content/,
            // Zenodo
            /zenodo\.org\/records?\//,
            // ASM Journals
            /journals\.asm\.org\/doi\//,
            // BMJ
            /bmj\.com\/content\//,
            // ACL Anthology
            /aclanthology\.org\/[A-Z0-9.-]+\//,
            // AMS Journals
            /journals\.ametsoc\.org\/view\/journals\//,
            // Substack (for academic newsletters)
            /substack\.com\/p\//,
            // CiteSeerX
            /citeseerx\.ist\.psu\.edu\//,
            // Hugging Face Papers
            /huggingface\.co\/papers\//,
            // Papers With Code
            /paperswithcode\.com\/paper\//,
            // Google Scholar direct links
            /scholar\.google\.com\/scholar\?.*cluster=/,
            // SSRN
            /papers\.ssrn\.com\/sol3\/papers\.cfm/,
            /ssrn\.com\/abstract=/,
            // Cambridge Core
            /cambridge\.org\/core\/journals\/.*\/article\//,
            // Annual Reviews
            /annualreviews\.org\/doi\//,
            // Generic DOI patterns
            /\/doi\/(?:abs|full|pdf|epdf)?\/?10\.\d+\//,
            // Generic PDF patterns (academic contexts)
            /\.pdf(?:\?|$)/,
        ];
        // Content script matches - used for canHandleUrl checks
        this.contentScriptMatches = [
            "sciencedirect.com/science/article/",
            "philpapers.org/rec/",
            "proceedings.neurips.cc/paper_files/paper/",
            "journals.sagepub.com/doi/",
            "link.springer.com/article/",
            ".science.org/doi/",
            "journals.aps.org/prx/abstract/",
            "onlinelibrary.wiley.com/doi/",
            "cell.com/trends/cognitive-sciences/fulltext/",
            "researchgate.net/publication/",
            "psycnet.apa.org/record/",
            "biorxiv.org/content/",
            "medrxiv.org/content/",
            "osf.io/preprints/",
            "frontiersin.org/journals/",
            "frontiersin.org/articles/",
            "jstor.org/stable/",
            "proceedings.mlr.press/",
            "journals.plos.org/plosone/article",
            "ieeexplore.ieee.org/document/",
            "royalsocietypublishing.org/doi/",
            "papers.nips.cc/paper_files/paper/",
            "philarchive.org/archive/",
            "tandfonline.com/doi/",
            "iopscience.iop.org/article/",
            "academic.oup.com/brain/article/",
            "elifesciences.org/articles/",
            "escholarship.org/content/",
            "pmc.ncbi.nlm.nih.gov/articles/",
            "ncbi.nlm.nih.gov/pmc/articles/",
            "pubmed.ncbi.nlm.nih.gov/",
            "openaccess.thecvf.com/content/",
            "zenodo.org/records/",
            "journals.asm.org/doi/full/",
            "physoc.onlinelibrary.wiley.com/doi/full/",
            "storage.courtlistener.com/recap/",
            "bmj.com/content/",
            "ntsb.gov/investigations/pages",
            "ntsb.gov/investigations/AccidentReports",
            "aclanthology.org/",
            "journals.ametsoc.org/view/journals/",
            "huggingface.co/papers/",
            "paperswithcode.com/paper/",
            "papers.ssrn.com/",
            "ssrn.com/abstract=",
            "cambridge.org/core/journals/",
            "annualreviews.org/doi/",
            "substack.com/p/",
            "citeseerx.",
            "/doi/",
            "/pdf/",
        ];
    }
    canHandleUrl(url) {
        // First check urlPatterns (regex)
        if (this.urlPatterns.some(pattern => pattern.test(url))) {
            return true;
        }
        // Then check contentScriptMatches (substring)
        return this.contentScriptMatches.some(pattern => url.includes(pattern));
    }
}
const miscIntegration = new MiscIntegration();

// extension/source-integration/registry.ts
const sourceIntegrations = [
    arxivIntegration,
    openReviewIntegration,
    natureIntegration,
    pnasIntegration,
    scienceDirectIntegration,
    springerIntegration,
    ieeeIntegration,
    acmIntegration,
    aclIntegration,
    neuripsIntegration,
    cvfIntegration,
    wileyIntegration,
    plosIntegration,
    bioRxivIntegration,
    medRxivIntegration,
    ssrnIntegration,
    semanticScholarIntegration,
    miscIntegration,
];

// background.ts
const logger = loguru.getLogger('background');
// Global state
let githubToken = '';
let githubRepo = '';
let paperManager = null;
let sessionService = null;
let popupManager = null;
let sourceManager = null;
// Initialize sources
function initializeSources() {
    sourceManager = new SourceIntegrationManager();
    // Register all sources from the central registry
    for (const integration of sourceIntegrations) {
        sourceManager.registerSource(integration);
    }
    logger.info('Source manager initialized with integrations:', sourceIntegrations.map(int => int.id).join(', '));
    return sourceManager;
}
// Initialize everything
async function initialize() {
    try {
        // Initialize sources first
        initializeSources();
        // Load GitHub credentials
        const items = await chrome.storage.sync.get(['githubToken', 'githubRepo']);
        githubToken = items.githubToken || '';
        githubRepo = items.githubRepo || '';
        logger.info('Credentials loaded', { hasToken: !!githubToken, hasRepo: !!githubRepo });
        // Initialize paper manager if we have credentials
        if (githubToken && githubRepo) {
            const githubClient = new d(githubToken, githubRepo);
            // Pass the source manager to the paper manager
            paperManager = new PaperManager(githubClient, sourceManager);
            logger.info('Paper manager initialized');
            // Initialize session service with paper manager
            sessionService = new SessionService(paperManager);
        }
        else {
            // Initialize session service without paper manager
            sessionService = new SessionService(null);
        }
        logger.info('Session service initialized');
        // Initialize popup manager
        popupManager = new PopupManager(() => sourceManager, () => paperManager);
        logger.info('Popup manager initialized');
        // Set up message listeners
        setupMessageListeners();
        // Initialize debug objects
        initializeDebugObjects();
    }
    catch (error) {
        logger.error('Initialization error', error);
    }
}
// Set up message listeners
function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'contentScriptReady' && sender.tab?.id) {
            logger.debug('Content script ready:', sender.tab.url);
            sendResponse({ success: true });
            return true;
        }
        if (message.type === 'paperMetadata' && message.metadata) {
            // Store metadata received from content script
            handlePaperMetadata(message.metadata)
                .then(result => {
                sendResponse({ success: true, storedInGitHub: result.storedInGitHub });
            })
                .catch(error => {
                logger.error('Error handling paper metadata', error);
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            });
            return true; // Will respond asynchronously
        }
        if (message.type === 'getCurrentPaper') {
            const session = sessionService?.getCurrentSession();
            const paperMetadata = session
                ? sessionService?.getPaperMetadata(session.sourceId, session.paperId)
                : null;
            logger.debug('Popup requested current paper', paperMetadata);
            sendResponse(paperMetadata);
            return true;
        }
        if (message.type === 'updateRating') {
            logger.debug('Rating update requested:', message.rating);
            handleUpdateRating(message.rating, sendResponse);
            return true; // Will respond asynchronously
        }
        if (message.type === 'startSession') {
            handleStartSession(message.sourceId, message.paperId);
            sendResponse({ success: true });
            return true;
        }
        if (message.type === 'sessionHeartbeat') {
            handleSessionHeartbeat();
            sendResponse({ success: true });
            return true;
        }
        if (message.type === 'endSession') {
            handleEndSession(message.reason || 'user_action');
            sendResponse({ success: true });
            return true;
        }
        // New handler for manual paper logging from popup
        if (message.type === 'manualPaperLog' && message.metadata) {
            handleManualPaperLog(message.metadata)
                .then(() => sendResponse({ success: true }))
                .catch(error => {
                logger.error('Error handling manual paper log', error);
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            });
            return true; // Will respond asynchronously
        }
        // Other message handlers are managed by PopupManager
        return false; // Not handled
    });
}
// Handle paper metadata from content script
async function handlePaperMetadata(metadata) {
    logger.info(`Received metadata for ${metadata.sourceId}:${metadata.paperId}`);
    // Store metadata in session service
    if (sessionService) {
        sessionService.storePaperMetadata(metadata);
    }
    // Store in GitHub if we have a paper manager
    if (paperManager) {
        await paperManager.getOrCreatePaper(metadata);
        logger.debug('Paper metadata stored in GitHub');
        return { storedInGitHub: true };
    }
    else {
        logger.warning('Paper manager not initialized - GitHub credentials may not be configured');
        return { storedInGitHub: false };
    }
}
// Handle rating update
async function handleUpdateRating(rating, sendResponse) {
    if (!paperManager || !sessionService) {
        sendResponse({ success: false, error: 'Services not initialized' });
        return;
    }
    const session = sessionService.getCurrentSession();
    if (!session) {
        sendResponse({ success: false, error: 'No current session' });
        return;
    }
    const metadata = sessionService.getPaperMetadata();
    if (!metadata) {
        sendResponse({ success: false, error: 'No paper metadata available' });
        return;
    }
    try {
        await paperManager.updateRating(session.sourceId, session.paperId, rating, metadata);
        // Update stored metadata with new rating
        metadata.rating = rating;
        sendResponse({ success: true });
    }
    catch (error) {
        logger.error('Error updating rating:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
// Handle session start request
function handleStartSession(sourceId, paperId) {
    if (!sessionService) {
        logger.error('Session service not initialized');
        return;
    }
    // Get metadata if available
    const existingMetadata = sessionService.getPaperMetadata(sourceId, paperId);
    // Start the session
    sessionService.startSession(sourceId, paperId, existingMetadata);
    logger.info(`Started session for ${sourceId}:${paperId}`);
}
// Handle session heartbeat
function handleSessionHeartbeat() {
    if (!sessionService) {
        logger.error('Session service not initialized');
        return;
    }
    sessionService.recordHeartbeat();
}
// Handle session end request
function handleEndSession(reason) {
    if (!sessionService) {
        logger.error('Session service not initialized');
        return;
    }
    const session = sessionService.getCurrentSession();
    if (session) {
        logger.info(`Ending session: ${reason}`);
        sessionService.endSession();
    }
}
async function handleManualPaperLog(metadata) {
    logger.info(`Received manual paper log: ${metadata.sourceId}:${metadata.paperId}`);
    // Store metadata in session service
    if (sessionService) {
        sessionService.storePaperMetadata(metadata);
    }
    // Store in GitHub if we have a paper manager
    if (paperManager) {
        await paperManager.getOrCreatePaper(metadata);
        logger.debug('Manually logged paper stored in GitHub');
    }
    else {
        throw new Error('GitHub credentials not configured. Please set up your token and repository in the extension options.');
    }
}
// Listen for credential changes
chrome.storage.onChanged.addListener(async (changes) => {
    logger.debug('Storage changes detected', Object.keys(changes));
    if (changes.githubToken) {
        githubToken = changes.githubToken.newValue;
    }
    if (changes.githubRepo) {
        githubRepo = changes.githubRepo.newValue;
    }
    // Reinitialize paper manager if credentials changed
    if (changes.githubToken || changes.githubRepo) {
        if (githubToken && githubRepo) {
            const githubClient = new d(githubToken, githubRepo);
            // Pass the source manager to the paper manager
            paperManager = new PaperManager(githubClient, sourceManager);
            logger.info('Paper manager reinitialized');
            // Reinitialize session service with new paper manager
            sessionService = new SessionService(paperManager);
            logger.info('Session service reinitialized');
        }
    }
});
// Initialize debug objects in service worker scope
function initializeDebugObjects() {
    // @ts-ignore
    self.__DEBUG__ = {
        get paperManager() { return paperManager; },
        get sessionService() { return sessionService; },
        get popupManager() { return popupManager; },
        get sourceManager() { return sourceManager; },
        getGithubClient: () => paperManager ? paperManager.getClient() : null,
        getCurrentPaper: () => {
            const session = sessionService?.getCurrentSession();
            return session ? sessionService?.getPaperMetadata(session.sourceId, session.paperId) : null;
        },
        getSessionStats: () => sessionService?.getSessionStats(),
        getSources: () => sourceManager?.getAllSources(),
        forceEndSession: () => sessionService?.endSession()
    };
    logger.info('Debug objects registered');
}
// Initialize extension
initialize();
//# sourceMappingURL=background.bundle.js.map
