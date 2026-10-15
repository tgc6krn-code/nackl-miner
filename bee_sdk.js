/* @ts-self-types="./bee_sdk.d.ts" */

export class ActiveConnectSession {
    static __wrap(ptr) {
        const obj = Object.create(ActiveConnectSession.prototype);
        obj.__wbg_ptr = ptr;
        ActiveConnectSessionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ActiveConnectSessionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_activeconnectsession_free(ptr, 0);
    }
    /**
     * @returns {string | undefined}
     */
    get app_id() {
        const ret = wasm.activeconnectsession_app_id(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {bigint}
     */
    get deployed_at() {
        const ret = wasm.activeconnectsession_deployed_at(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {string}
     */
    get deployed_event_id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.activeconnectsession_deployed_event_id(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get description() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.activeconnectsession_description(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get profile_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.activeconnectsession_profile_address(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string | undefined}
     */
    get session_id() {
        const ret = wasm.activeconnectsession_session_id(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
}
if (Symbol.dispose) ActiveConnectSession.prototype[Symbol.dispose] = ActiveConnectSession.prototype.free;

export class BeeConnect {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BeeConnectFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_beeconnect_free(ptr, 0);
    }
    /**
     * Creates a `shared_key` session and returns payload + temporary owner
     * keys.
     * @param {string} app_id
     * @param {number | null} [ttl_secs]
     * @param {string | null} [nonce]
     * @returns {ResultOfCreateSharedKeySession}
     */
    create_shared_key_session(app_id, ttl_secs, nonce) {
        const ptr0 = passStringToWasm0(app_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(nonce) ? 0 : passStringToWasm0(nonce, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.beeconnect_create_shared_key_session(this.__wbg_ptr, ptr0, len0, isLikeNone(ttl_secs) ? Number.MAX_SAFE_INTEGER : (ttl_secs) >>> 0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ResultOfCreateSharedKeySession.__wrap(ret[0]);
    }
    /**
     * Decodes and validates base64url connect payload (`payload` query
     * value).
     * @param {string} payload_b64url
     * @returns {ParsedConnectPayload}
     */
    decode_connect_payload_b64url(payload_b64url) {
        const ptr0 = passStringToWasm0(payload_b64url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.beeconnect_decode_connect_payload_b64url(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ParsedConnectPayload.__wrap(ret[0]);
    }
    /**
     * Sends a `client_disconnect` message (`dir = c2w`) to the connected
     * profile. Performs DH re-key for forward secrecy.
     * @param {string[]} endpoints
     * @param {string} session_id
     * @param {string} description
     * @param {string} session_state_json
     * @param {string | null} [reason]
     * @param {number | null} [max_attempts]
     * @param {number | null} [interval_ms]
     * @returns {Promise<ResultOfDisconnectSession>}
     */
    disconnect_session(endpoints, session_id, description, session_state_json, reason, max_attempts, interval_ms) {
        const ptr0 = passArrayJsValueToWasm0(endpoints, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(session_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(description, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(session_state_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(reason) ? 0 : passStringToWasm0(reason, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len4 = WASM_VECTOR_LEN;
        const ret = wasm.beeconnect_disconnect_session(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, isLikeNone(max_attempts) ? Number.MAX_SAFE_INTEGER : (max_attempts) >>> 0, isLikeNone(interval_ms) ? Number.MAX_SAFE_INTEGER : (interval_ms) >>> 0);
        return ret;
    }
    /**
     * Returns `true` if session profile is currently deployed.
     * @param {string[]} endpoints
     * @param {string} description
     * @returns {Promise<boolean>}
     */
    is_session_profile_deployed(endpoints, description) {
        const ptr0 = passArrayJsValueToWasm0(endpoints, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(description, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.beeconnect_is_session_profile_deployed(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret;
    }
    /**
     * Creates a new wasm-facing `bee_connect` client wrapper.
     * @param {number | null} [max_rps]
     */
    constructor(max_rps) {
        const ret = wasm.beeconnect_new(isLikeNone(max_rps) ? Number.MAX_SAFE_INTEGER : (max_rps) >>> 0);
        this.__wbg_ptr = ret;
        BeeConnectFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Small health-check helper for smoke tests.
     * @returns {string}
     */
    ping() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.beeconnect_ping(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Queries one chunk of active connect sessions by multifactor.
     *
     * Returns at most 10 deployed `bee_connect` sessions and a cursor for the
     * next chunk. Optional `app_id` filters to one application.
     * @param {string[]} endpoints
     * @param {string} multifactor_address
     * @param {string | null} [app_id]
     * @param {bigint | null} [created_at_from]
     * @param {string | null} [before]
     * @returns {Promise<ResultOfQueryActiveSessionsByMultifactor>}
     */
    query_active_sessions_by_multifactor(endpoints, multifactor_address, app_id, created_at_from, before) {
        const ptr0 = passArrayJsValueToWasm0(endpoints, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(multifactor_address, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(app_id) ? 0 : passStringToWasm0(app_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(before) ? 0 : passStringToWasm0(before, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len3 = WASM_VECTOR_LEN;
        const ret = wasm.beeconnect_query_active_sessions_by_multifactor(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, !isLikeNone(created_at_from), isLikeNone(created_at_from) ? BigInt(0) : created_at_from, ptr3, len3);
        return ret;
    }
    /**
     * Sends `set_mining_keys` request (`dir = c2w`) to wallet over connect
     * profile. Performs DH re-key for forward secrecy.
     * @param {string[]} endpoints
     * @param {string} session_id
     * @param {string} description
     * @param {string} session_state_json
     * @param {string} app_id
     * @param {string} owner_public
     * @param {number | null} [max_attempts]
     * @param {number | null} [interval_ms]
     * @returns {Promise<ResultOfRequestSetMiningKeys>}
     */
    request_set_mining_keys(endpoints, session_id, description, session_state_json, app_id, owner_public, max_attempts, interval_ms) {
        const ptr0 = passArrayJsValueToWasm0(endpoints, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(session_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(description, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(session_state_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(app_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passStringToWasm0(owner_public, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len5 = WASM_VECTOR_LEN;
        const ret = wasm.beeconnect_request_set_mining_keys(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, isLikeNone(max_attempts) ? Number.MAX_SAFE_INTEGER : (max_attempts) >>> 0, isLikeNone(interval_ms) ? Number.MAX_SAFE_INTEGER : (interval_ms) >>> 0);
        return ret;
    }
    /**
     * Sends `sign_challenge` (`dir = c2w`) to the wallet. The wallet should
     * sign the nonce and respond with `challenge_response`.
     * @param {string[]} endpoints
     * @param {string} session_id
     * @param {string} description
     * @param {string} session_state_json
     * @param {string} nonce
     * @param {number | null} [max_attempts]
     * @param {number | null} [interval_ms]
     * @returns {Promise<ResultOfRequestSignChallenge>}
     */
    request_sign_challenge(endpoints, session_id, description, session_state_json, nonce, max_attempts, interval_ms) {
        const ptr0 = passArrayJsValueToWasm0(endpoints, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(session_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(description, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(session_state_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(nonce, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.beeconnect_request_sign_challenge(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, isLikeNone(max_attempts) ? Number.MAX_SAFE_INTEGER : (max_attempts) >>> 0, isLikeNone(interval_ms) ? Number.MAX_SAFE_INTEGER : (interval_ms) >>> 0);
        return ret;
    }
    /**
     * Resolves deterministic `AuthProfile` address by `description`.
     * @param {string[]} endpoints
     * @param {string} description
     * @returns {Promise<string>}
     */
    resolve_profile_address(endpoints, description) {
        const ptr0 = passArrayJsValueToWasm0(endpoints, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(description, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.beeconnect_resolve_profile_address(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret;
    }
    /**
     * Waits for `challenge_response` (`dir = w2c`) from the wallet.
     * @param {string[]} endpoints
     * @param {string} session_id
     * @param {string} description
     * @param {string | null} [session_state_json]
     * @param {bigint | null} [created_at_from]
     * @param {number | null} [max_attempts]
     * @param {number | null} [interval_ms]
     * @returns {Promise<ResultOfWaitChallengeResponse>}
     */
    wait_challenge_response(endpoints, session_id, description, session_state_json, created_at_from, max_attempts, interval_ms) {
        const ptr0 = passArrayJsValueToWasm0(endpoints, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(session_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(description, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(session_state_json) ? 0 : passStringToWasm0(session_state_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len3 = WASM_VECTOR_LEN;
        const ret = wasm.beeconnect_wait_challenge_response(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, !isLikeNone(created_at_from), isLikeNone(created_at_from) ? BigInt(0) : created_at_from, isLikeNone(max_attempts) ? Number.MAX_SAFE_INTEGER : (max_attempts) >>> 0, isLikeNone(interval_ms) ? Number.MAX_SAFE_INTEGER : (interval_ms) >>> 0);
        return ret;
    }
    /**
     * Waits for `set_mining_keys` request (`dir = c2w`) in session profile.
     * @param {string[]} endpoints
     * @param {string} session_id
     * @param {string} description
     * @param {bigint | null} [created_at_from]
     * @param {number | null} [max_attempts]
     * @param {number | null} [interval_ms]
     * @param {string | null} [session_state_json]
     * @returns {Promise<ResultOfWaitSetMiningKeysRequest>}
     */
    wait_set_mining_keys_request(endpoints, session_id, description, created_at_from, max_attempts, interval_ms, session_state_json) {
        const ptr0 = passArrayJsValueToWasm0(endpoints, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(session_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(description, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(session_state_json) ? 0 : passStringToWasm0(session_state_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len3 = WASM_VECTOR_LEN;
        const ret = wasm.beeconnect_wait_set_mining_keys_request(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, !isLikeNone(created_at_from), isLikeNone(created_at_from) ? BigInt(0) : created_at_from, isLikeNone(max_attempts) ? Number.MAX_SAFE_INTEGER : (max_attempts) >>> 0, isLikeNone(interval_ms) ? Number.MAX_SAFE_INTEGER : (interval_ms) >>> 0, ptr3, len3);
        return ret;
    }
    /**
     * Waits for the wallet's first `wallet_hello` message on the profile.
     * @param {string[]} endpoints
     * @param {string} session_id
     * @param {string} description
     * @param {string} client_dh_secret
     * @param {bigint | null} [created_at_from]
     * @param {number | null} [max_attempts]
     * @param {number | null} [interval_ms]
     * @returns {Promise<ResultOfWaitWalletHello>}
     */
    wait_wallet_hello(endpoints, session_id, description, client_dh_secret, created_at_from, max_attempts, interval_ms) {
        const ptr0 = passArrayJsValueToWasm0(endpoints, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(session_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(description, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(client_dh_secret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.beeconnect_wait_wallet_hello(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, !isLikeNone(created_at_from), isLikeNone(created_at_from) ? BigInt(0) : created_at_from, isLikeNone(max_attempts) ? Number.MAX_SAFE_INTEGER : (max_attempts) >>> 0, isLikeNone(interval_ms) ? Number.MAX_SAFE_INTEGER : (interval_ms) >>> 0);
        return ret;
    }
}
if (Symbol.dispose) BeeConnect.prototype[Symbol.dispose] = BeeConnect.prototype.free;

export class ConnectSessionMessage {
    static __wrap(ptr) {
        const obj = Object.create(ConnectSessionMessage.prototype);
        obj.__wbg_ptr = ptr;
        ConnectSessionMessageFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ConnectSessionMessageFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_connectsessionmessage_free(ptr, 0);
    }
    /**
     * `true` when the encrypted body was actually decrypted for this message.
     * `body_json` is not a substitute: it falls back to the raw envelope body
     * when decryption fails, so it is always non-empty.
     * @returns {boolean}
     */
    get body_decrypted() {
        const ret = wasm.connectsessionmessage_body_decrypted(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {string}
     */
    get body_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.connectsessionmessage_body_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string | undefined}
     */
    get challenge_epk_public() {
        const ret = wasm.connectsessionmessage_challenge_epk_public(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string | undefined}
     */
    get challenge_nonce() {
        const ret = wasm.connectsessionmessage_challenge_nonce(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string | undefined}
     */
    get challenge_signature() {
        const ret = wasm.connectsessionmessage_challenge_signature(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string}
     */
    get dir() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.connectsessionmessage_dir(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string | undefined}
     */
    get disconnect_reason() {
        const ret = wasm.connectsessionmessage_disconnect_reason(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {bigint}
     */
    get event_created_at() {
        const ret = wasm.connectsessionmessage_event_created_at(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {string}
     */
    get event_id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.connectsessionmessage_event_id(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string | undefined}
     */
    get mining_app_id() {
        const ret = wasm.connectsessionmessage_mining_app_id(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string | undefined}
     */
    get mining_owner_public() {
        const ret = wasm.connectsessionmessage_mining_owner_public(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string}
     */
    get msg_type() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.connectsessionmessage_msg_type(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get raw_message_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.connectsessionmessage_raw_message_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {bigint}
     */
    get seq() {
        const ret = wasm.connectsessionmessage_seq(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Session state snapshot taken immediately after `rekey_inbound` for this
     * message. Present only for c2w messages that triggered a successful DH
     * re-key. Use this when responding to the message (e.g. sending
     * `challenge_response` after receiving `sign_challenge`).
     * @returns {string | undefined}
     */
    get session_state_after_json() {
        const ret = wasm.connectsessionmessage_session_state_after_json(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {bigint | undefined}
     */
    get ts() {
        const ret = wasm.connectsessionmessage_ts(this.__wbg_ptr);
        return ret[0] === 0 ? undefined : BigInt.asUintN(64, ret[1]);
    }
    /**
     * @returns {string | undefined}
     */
    get wallet_address() {
        const ret = wasm.connectsessionmessage_wallet_address(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string | undefined}
     */
    get wallet_name() {
        const ret = wasm.connectsessionmessage_wallet_name(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
}
if (Symbol.dispose) ConnectSessionMessage.prototype[Symbol.dispose] = ConnectSessionMessage.prototype.free;

/**
 * High-level wasm API for crypto operations.
 */
export class Crypto {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CryptoFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_crypto_free(ptr, 0);
    }
    /**
     * Decrypts data previously encrypted with `encrypt`.
     * @param {string} encrypted
     * @param {string} password
     * @returns {Promise<string>}
     */
    decrypt(encrypted, password) {
        const ptr0 = passStringToWasm0(encrypted, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.crypto_decrypt(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret;
    }
    /**
     * Encrypts plaintext with a password.
     * @param {string} plaintext
     * @param {string} password
     * @returns {Promise<CryptoResultOfEncrypt>}
     */
    encrypt(plaintext, password) {
        const ptr0 = passStringToWasm0(plaintext, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.crypto_encrypt(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret;
    }
    /**
     * Generates a short-lived mining keypair.
     * @returns {Promise<CryptoResultOfGetKeys>}
     */
    gen_mining_keys() {
        const ret = wasm.crypto_gen_mining_keys(this.__wbg_ptr);
        return ret;
    }
    /**
     * Generates a mnemonic with the requested word count and derives keys from
     * it.
     * @param {number} word_count
     * @returns {Promise<CryptoResultOfGenSeedAndKeys>}
     */
    gen_mnemonic_and_derive_keys(word_count) {
        const ret = wasm.crypto_gen_mnemonic_and_derive_keys(this.__wbg_ptr, word_count);
        return ret;
    }
    /**
     * Derives keys using the requested mnemonic word count.
     * @param {string} phrase
     * @param {number} word_count
     * @returns {Promise<CryptoResultOfGetKeys>}
     */
    get_keys_from_mnemonic(phrase, word_count) {
        const ptr0 = passStringToWasm0(phrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.crypto_get_keys_from_mnemonic(this.__wbg_ptr, ptr0, len0, word_count);
        return ret;
    }
    /**
     * Derives keys from a mnemonic phrase using a specific HD derivation path.
     * @param {string} phrase
     * @param {string} path
     * @param {number} word_count
     * @returns {Promise<CryptoResultOfGetKeys>}
     */
    get_keys_from_mnemonic_with_path(phrase, path, word_count) {
        const ptr0 = passStringToWasm0(phrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(path, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.crypto_get_keys_from_mnemonic_with_path(this.__wbg_ptr, ptr0, len0, ptr1, len1, word_count);
        return ret;
    }
    /**
     * Computes a salted password hash in `v3:<salt_hex>:<dk_hex>` format.
     * @param {string} data
     * @returns {Promise<string>}
     */
    hash_password(data) {
        const ptr0 = passStringToWasm0(data, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.crypto_hash_password(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * Creates a crypto client bound to network endpoints.
     * @param {string[]} endpoints
     */
    constructor(endpoints) {
        const ptr0 = passArrayJsValueToWasm0(endpoints, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.crypto_new(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        CryptoFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Signs base64-encoded payload with an Ed25519 keypair.
     * @param {TParamsOfSign} params_js
     * @returns {Promise<CryptoResultOfSign>}
     */
    sign(params_js) {
        const ret = wasm.crypto_sign(this.__wbg_ptr, params_js);
        return ret;
    }
    /**
     * Verifies mnemonic checksum, format, and the requested word count.
     * @param {string} phrase
     * @param {number} word_count
     * @returns {Promise<boolean>}
     */
    verify_mnemonic(phrase, word_count) {
        const ptr0 = passStringToWasm0(phrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.crypto_verify_mnemonic(this.__wbg_ptr, ptr0, len0, word_count);
        return ret;
    }
    /**
     * Verifies a plain password against a `v2` or `v3` hash.
     * @param {string} password
     * @param {string} expected
     * @returns {Promise<boolean>}
     */
    verify_password_hash(password, expected) {
        const ptr0 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(expected, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.crypto_verify_password_hash(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret;
    }
}
if (Symbol.dispose) Crypto.prototype[Symbol.dispose] = Crypto.prototype.free;

export class CryptoResultOfEncrypt {
    static __wrap(ptr) {
        const obj = Object.create(CryptoResultOfEncrypt.prototype);
        obj.__wbg_ptr = ptr;
        CryptoResultOfEncryptFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CryptoResultOfEncryptFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cryptoresultofencrypt_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get encrypted() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.cryptoresultofencrypt_encrypted(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) CryptoResultOfEncrypt.prototype[Symbol.dispose] = CryptoResultOfEncrypt.prototype.free;

export class CryptoResultOfGenSeedAndKeys {
    static __wrap(ptr) {
        const obj = Object.create(CryptoResultOfGenSeedAndKeys.prototype);
        obj.__wbg_ptr = ptr;
        CryptoResultOfGenSeedAndKeysFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CryptoResultOfGenSeedAndKeysFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cryptoresultofgenseedandkeys_free(ptr, 0);
    }
    /**
     * @returns {CryptoResultOfGetKeys}
     */
    get keys() {
        const ret = wasm.cryptoresultofgenseedandkeys_keys(this.__wbg_ptr);
        return CryptoResultOfGetKeys.__wrap(ret);
    }
    /**
     * @returns {string}
     */
    get phrase() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.cryptoresultofgenseedandkeys_phrase(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) CryptoResultOfGenSeedAndKeys.prototype[Symbol.dispose] = CryptoResultOfGenSeedAndKeys.prototype.free;

export class CryptoResultOfGetKeys {
    static __wrap(ptr) {
        const obj = Object.create(CryptoResultOfGetKeys.prototype);
        obj.__wbg_ptr = ptr;
        CryptoResultOfGetKeysFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CryptoResultOfGetKeysFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cryptoresultofgetkeys_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get public() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.cryptoresultofgetkeys_public(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get secret() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.cryptoresultofgetkeys_secret(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) CryptoResultOfGetKeys.prototype[Symbol.dispose] = CryptoResultOfGetKeys.prototype.free;

export class CryptoResultOfSign {
    static __wrap(ptr) {
        const obj = Object.create(CryptoResultOfSign.prototype);
        obj.__wbg_ptr = ptr;
        CryptoResultOfSignFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CryptoResultOfSignFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cryptoresultofsign_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get signature() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.cryptoresultofsign_signature(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get signed() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.cryptoresultofsign_signed(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) CryptoResultOfSign.prototype[Symbol.dispose] = CryptoResultOfSign.prototype.free;

export class GraphqlBlockData {
    static __wrap(ptr) {
        const obj = Object.create(GraphqlBlockData.prototype);
        obj.__wbg_ptr = ptr;
        GraphqlBlockDataFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        GraphqlBlockDataFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_graphqlblockdata_free(ptr, 0);
    }
    /**
     * @returns {bigint}
     */
    get seq_no() {
        const ret = wasm.__wbg_get_graphqlblockdata_seq_no(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @param {bigint} arg0
     */
    set seq_no(arg0) {
        wasm.__wbg_set_graphqlblockdata_seq_no(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) GraphqlBlockData.prototype[Symbol.dispose] = GraphqlBlockData.prototype.free;

export class IssBase64Details {
    static __wrap(ptr) {
        const obj = Object.create(IssBase64Details.prototype);
        obj.__wbg_ptr = ptr;
        IssBase64DetailsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IssBase64DetailsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_issbase64details_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get index_mod4() {
        const ret = wasm.issbase64details_index_mod4(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get value() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.issbase64details_value(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) IssBase64Details.prototype[Symbol.dispose] = IssBase64Details.prototype.free;

export class Miner {
    static __wrap(ptr) {
        const obj = Object.create(Miner.prototype);
        obj.__wbg_ptr = ptr;
        MinerFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MinerFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_miner_free(ptr, 0);
    }
    /**
     * @param {number} x
     * @param {number} y
     */
    add_tap(x, y) {
        const ret = wasm.miner_add_tap(this.__wbg_ptr, x, y);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @returns {boolean}
     */
    can_start() {
        const ret = wasm.miner_can_start(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {Promise<GraphqlBlockData>}
     */
    get_current_block() {
        const ret = wasm.miner_get_current_block(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Promise<MinerAccountData>}
     */
    get_miner_data() {
        const ret = wasm.miner_get_miner_data(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Promise<void>}
     */
    get_reward() {
        const ret = wasm.miner_get_reward(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {string[]} endpoints
     * @param {string} app_id
     * @param {string} address
     * @param {string} public_key
     * @param {string} secret_key
     * @returns {Promise<Miner>}
     */
    static new(endpoints, app_id, address, public_key, secret_key) {
        const ptr0 = passArrayJsValueToWasm0(endpoints, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(app_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(address, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(public_key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(secret_key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.miner_new(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        return ret;
    }
    /**
     * @param {string} seed
     */
    remove_seed(seed) {
        const ptr0 = passStringToWasm0(seed, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.miner_remove_seed(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} duration_ms
     * @param {Function} callback
     */
    start(duration_ms, callback) {
        const ret = wasm.miner_start(this.__wbg_ptr, duration_ms, callback);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    stop() {
        wasm.miner_stop(this.__wbg_ptr);
    }
}
if (Symbol.dispose) Miner.prototype[Symbol.dispose] = Miner.prototype.free;

export class MinerAccountData {
    static __wrap(ptr) {
        const obj = Object.create(MinerAccountData.prototype);
        obj.__wbg_ptr = ptr;
        MinerAccountDataFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MinerAccountDataFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_mineraccountdata_free(ptr, 0);
    }
    /**
     * @returns {bigint}
     */
    get epoch_5m_start() {
        const ret = wasm.__wbg_get_mineraccountdata_epoch_5m_start(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {bigint}
     */
    get epoch_start() {
        const ret = wasm.__wbg_get_mineraccountdata_epoch_start(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {bigint}
     */
    get tap_sum_5m() {
        const ret = wasm.__wbg_get_mineraccountdata_tap_sum_5m(this.__wbg_ptr);
        return (BigInt.asUintN(64, ret[0]) | (BigInt.asUintN(64, ret[1]) << BigInt(64)));
    }
    /**
     * @returns {bigint}
     */
    get tap_sum() {
        const ret = wasm.__wbg_get_mineraccountdata_tap_sum(this.__wbg_ptr);
        return (BigInt.asUintN(64, ret[0]) | (BigInt.asUintN(64, ret[1]) << BigInt(64)));
    }
    /**
     * @param {bigint} arg0
     */
    set epoch_5m_start(arg0) {
        wasm.__wbg_set_mineraccountdata_epoch_5m_start(this.__wbg_ptr, arg0);
    }
    /**
     * @param {bigint} arg0
     */
    set epoch_start(arg0) {
        wasm.__wbg_set_mineraccountdata_epoch_start(this.__wbg_ptr, arg0);
    }
    /**
     * @param {bigint} arg0
     */
    set tap_sum_5m(arg0) {
        wasm.__wbg_set_mineraccountdata_tap_sum_5m(this.__wbg_ptr, arg0, arg0 >> BigInt(64));
    }
    /**
     * @param {bigint} arg0
     */
    set tap_sum(arg0) {
        wasm.__wbg_set_mineraccountdata_tap_sum(this.__wbg_ptr, arg0, arg0 >> BigInt(64));
    }
}
if (Symbol.dispose) MinerAccountData.prototype[Symbol.dispose] = MinerAccountData.prototype.free;

/**
 * Decoded `Multifactor` contract account state. Mirrors
 * `ackinacki_kit::contracts::mvsystem::multifactor::AccountData`.
 */
export class MultifactorAccountData {
    static __wrap(ptr) {
        const obj = Object.create(MultifactorAccountData.prototype);
        obj.__wbg_ptr = ptr;
        MultifactorAccountDataFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MultifactorAccountDataFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_multifactoraccountdata_free(ptr, 0);
    }
    /**
     * @returns {TCandidateOwnerPubkeyExpirationMap}
     */
    get candidate_new_owner_pubkey_and_expiration() {
        const ret = wasm.multifactoraccountdata_candidate_new_owner_pubkey_and_expiration(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get factors_len() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_factors_len(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {TFactorsOrderedByTimestampMap}
     */
    get factors_ordered_by_timestamp() {
        const ret = wasm.multifactoraccountdata_factors_ordered_by_timestamp(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get force_remove_oldest() {
        const ret = wasm.multifactoraccountdata_force_remove_oldest(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {string}
     */
    get index_mod_4() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_index_mod_4(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get iss_base_64() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_iss_base_64(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {TJwkModulusDataMap}
     */
    get jwk_modulus_data() {
        const ret = wasm.multifactoraccountdata_jwk_modulus_data(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get jwk_modulus_data_len() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_jwk_modulus_data_len(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get jwk_update_key() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_jwk_update_key(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get m_security_cards_len() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_m_security_cards_len(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get m_transactions_len() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_m_transactions_len(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get max_cleanup_txns() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_max_cleanup_txns(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get min_value() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_min_value(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get owner_pubkey() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_owner_pubkey(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get pub_recovery_key() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_pub_recovery_key(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get root() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_root(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {boolean}
     */
    get use_security_card() {
        const ret = wasm.multifactoraccountdata_use_security_card(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {string}
     */
    get wasm_hash() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_wasm_hash(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {TWhiteListOfAddressMap}
     */
    get white_list_of_address() {
        const ret = wasm.multifactoraccountdata_white_list_of_address(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get zkid() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.multifactoraccountdata_zkid(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) MultifactorAccountData.prototype[Symbol.dispose] = MultifactorAccountData.prototype.free;

export class ParsedConnectPayload {
    static __wrap(ptr) {
        const obj = Object.create(ParsedConnectPayload.prototype);
        obj.__wbg_ptr = ptr;
        ParsedConnectPayloadFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ParsedConnectPayloadFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_parsedconnectpayload_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get app_id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.parsedconnectpayload_app_id(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get description() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.parsedconnectpayload_description(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {bigint}
     */
    get expires_at() {
        const ret = wasm.parsedconnectpayload_expires_at(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {string | undefined}
     */
    get nonce() {
        const ret = wasm.parsedconnectpayload_nonce(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string}
     */
    get session_id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.parsedconnectpayload_session_id(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get v() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.parsedconnectpayload_v(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ParsedConnectPayload.prototype[Symbol.dispose] = ParsedConnectPayload.prototype.free;

/**
 * Signed deploy params produced by `prepare_multifactor_deploy_params`.
 * Mirrors `ackinacki_kit::contracts::mvsystem::mirror::ParamsOfDeployMultifactor`.
 */
export class PreparedDeployParams {
    static __wrap(ptr) {
        const obj = Object.create(PreparedDeployParams.prototype);
        obj.__wbg_ptr = ptr;
        PreparedDeployParamsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PreparedDeployParamsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_prepareddeployparams_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get epk() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_epk(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {bigint}
     */
    get epk_expire_at() {
        const ret = wasm.prepareddeployparams_epk_expire_at(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {string}
     */
    get epk_sig() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_epk_sig(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get header_base_64() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_header_base_64(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get index_mod_4() {
        const ret = wasm.prepareddeployparams_index_mod_4(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get iss_base_64() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_iss_base_64(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get jwk_modulus() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_jwk_modulus(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {bigint}
     */
    get jwk_modulus_expire_at() {
        const ret = wasm.prepareddeployparams_jwk_modulus_expire_at(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {string}
     */
    get jwk_update_key() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_jwk_update_key(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get jwk_update_key_sig() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_jwk_update_key_sig(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get kid() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_kid(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get proof() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_proof(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get provider() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_provider(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get pub_recovery_key() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_pub_recovery_key(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get pub_recovery_key_sig() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_pub_recovery_key_sig(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {TRootProviderCertificatesMap}
     */
    get root_provider_certificates() {
        const ret = wasm.prepareddeployparams_root_provider_certificates(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get zkid() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.prepareddeployparams_zkid(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) PreparedDeployParams.prototype[Symbol.dispose] = PreparedDeployParams.prototype.free;

export class ResultGetMirrorAddress {
    static __wrap(ptr) {
        const obj = Object.create(ResultGetMirrorAddress.prototype);
        obj.__wbg_ptr = ptr;
        ResultGetMirrorAddressFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultGetMirrorAddressFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultgetmirroraddress_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultgetmirroraddress_address(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ResultGetMirrorAddress.prototype[Symbol.dispose] = ResultGetMirrorAddress.prototype.free;

export class ResultOfAddZKPFactor {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfAddZKPFactor.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfAddZKPFactorFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfAddZKPFactorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofaddzkpfactor_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofaddzkpfactor_address(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string | undefined}
     */
    get message_id() {
        const ret = wasm.resultofaddzkpfactor_message_id(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string[]}
     */
    get message_ids() {
        const ret = wasm.resultofaddzkpfactor_message_ids(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {string}
     */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofaddzkpfactor_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get password_hash() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofaddzkpfactor_password_hash(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get pubkey() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofaddzkpfactor_pubkey(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {ResultOfGetKeys}
     */
    get signing_keys() {
        const ret = wasm.resultofaddzkpfactor_signing_keys(this.__wbg_ptr);
        return ResultOfGetKeys.__wrap(ret);
    }
}
if (Symbol.dispose) ResultOfAddZKPFactor.prototype[Symbol.dispose] = ResultOfAddZKPFactor.prototype.free;

export class ResultOfBlockchainWrite {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfBlockchainWrite.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfBlockchainWriteFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfBlockchainWriteFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofblockchainwrite_free(ptr, 0);
    }
    /**
     * @returns {string[]}
     */
    get message_ids() {
        const ret = wasm.resultofblockchainwrite_message_ids(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {string | undefined}
     */
    get pending_reason() {
        const ret = wasm.resultofblockchainwrite_pending_reason(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string | undefined}
     */
    get pending_stage() {
        const ret = wasm.resultofblockchainwrite_pending_stage(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
}
if (Symbol.dispose) ResultOfBlockchainWrite.prototype[Symbol.dispose] = ResultOfBlockchainWrite.prototype.free;

export class ResultOfCheckNameAvailability {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfCheckNameAvailability.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfCheckNameAvailabilityFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfCheckNameAvailabilityFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofchecknameavailability_free(ptr, 0);
    }
    /**
     * @returns {boolean}
     */
    get is_available() {
        const ret = wasm.resultofchecknameavailability_is_available(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {string | undefined}
     */
    get multifactor_address() {
        const ret = wasm.resultofchecknameavailability_multifactor_address(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
}
if (Symbol.dispose) ResultOfCheckNameAvailability.prototype[Symbol.dispose] = ResultOfCheckNameAvailability.prototype.free;

export class ResultOfCreateSharedKeySession {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfCreateSharedKeySession.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfCreateSharedKeySessionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfCreateSharedKeySessionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofcreatesharedkeysession_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get app_id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofcreatesharedkeysession_app_id(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get client_dh_public() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofcreatesharedkeysession_client_dh_public(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get client_dh_secret() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofcreatesharedkeysession_client_dh_secret(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {bigint}
     */
    get created_at() {
        const ret = wasm.resultofcreatesharedkeysession_created_at(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {string}
     */
    get deep_link() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofcreatesharedkeysession_deep_link(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get description() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofcreatesharedkeysession_description(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {bigint}
     */
    get expires_at() {
        const ret = wasm.resultofcreatesharedkeysession_expires_at(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {string}
     */
    get payload_b64url() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofcreatesharedkeysession_payload_b64url(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get payload_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofcreatesharedkeysession_payload_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get session_id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofcreatesharedkeysession_session_id(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ResultOfCreateSharedKeySession.prototype[Symbol.dispose] = ResultOfCreateSharedKeySession.prototype.free;

export class ResultOfDeployMultifactor {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfDeployMultifactor.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfDeployMultifactorFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfDeployMultifactorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofdeploymultifactor_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofdeploymultifactor_address(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string | undefined}
     */
    get message_id() {
        const ret = wasm.resultofdeploymultifactor_message_id(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string[]}
     */
    get message_ids() {
        const ret = wasm.resultofdeploymultifactor_message_ids(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {string}
     */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofdeploymultifactor_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get password_hash() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofdeploymultifactor_password_hash(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string | undefined}
     */
    get pending_reason() {
        const ret = wasm.resultofdeploymultifactor_pending_reason(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string | undefined}
     */
    get pending_stage() {
        const ret = wasm.resultofdeploymultifactor_pending_stage(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string}
     */
    get phrase() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofdeploymultifactor_phrase(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get pubkey() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofdeploymultifactor_pubkey(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {ResultOfGetKeys}
     */
    get signing_keys() {
        const ret = wasm.resultofdeploymultifactor_signing_keys(this.__wbg_ptr);
        return ResultOfGetKeys.__wrap(ret);
    }
}
if (Symbol.dispose) ResultOfDeployMultifactor.prototype[Symbol.dispose] = ResultOfDeployMultifactor.prototype.free;

export class ResultOfDisconnectSession {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfDisconnectSession.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfDisconnectSessionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfDisconnectSessionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofdisconnectsession_free(ptr, 0);
    }
    /**
     * @returns {string | undefined}
     */
    get message_id() {
        const ret = wasm.resultofdisconnectsession_message_id(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string}
     */
    get profile_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofdisconnectsession_profile_address(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get raw_message_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofdisconnectsession_raw_message_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get updated_session_state_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofdisconnectsession_updated_session_state_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ResultOfDisconnectSession.prototype[Symbol.dispose] = ResultOfDisconnectSession.prototype.free;

export class ResultOfGenMiningKeys {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfGenMiningKeys.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfGenMiningKeysFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfGenMiningKeysFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofgenminingkeys_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get deep_link() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgenminingkeys_deep_link(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get public() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgenminingkeys_public(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get secret() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgenminingkeys_secret(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ResultOfGenMiningKeys.prototype[Symbol.dispose] = ResultOfGenMiningKeys.prototype.free;

export class ResultOfGetEPKExpireAt {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfGetEPKExpireAt.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfGetEPKExpireAtFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfGetEPKExpireAtFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofgetepkexpireat_free(ptr, 0);
    }
    /**
     * @returns {bigint}
     */
    get epk_expire_at() {
        const ret = wasm.resultofgetepkexpireat_epk_expire_at(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
}
if (Symbol.dispose) ResultOfGetEPKExpireAt.prototype[Symbol.dispose] = ResultOfGetEPKExpireAt.prototype.free;

export class ResultOfGetHistory {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfGetHistory.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfGetHistoryFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfGetHistoryFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofgethistory_free(ptr, 0);
    }
    /**
     * @returns {TxData[]}
     */
    get data() {
        const ret = wasm.resultofgethistory_data(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {boolean}
     */
    get has_next_page() {
        const ret = wasm.resultofgethistory_has_next_page(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {string | undefined}
     */
    get next_cursor() {
        const ret = wasm.resultofgethistory_next_cursor(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {string | undefined}
     */
    get next_mining_cursor() {
        const ret = wasm.resultofgethistory_next_mining_cursor(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
}
if (Symbol.dispose) ResultOfGetHistory.prototype[Symbol.dispose] = ResultOfGetHistory.prototype.free;

export class ResultOfGetKeys {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfGetKeys.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfGetKeysFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfGetKeysFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofgetkeys_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get public() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetkeys_public(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get secret() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetkeys_secret(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ResultOfGetKeys.prototype[Symbol.dispose] = ResultOfGetKeys.prototype.free;

export class ResultOfGetMinerDetails {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfGetMinerDetails.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfGetMinerDetailsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfGetMinerDetailsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofgetminerdetails_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetminerdetails_address(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get owner_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetminerdetails_owner_address(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {TMinerOwnerPublicMap}
     */
    get owner_public() {
        const ret = wasm.resultofgetminerdetails_owner_public(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) ResultOfGetMinerDetails.prototype[Symbol.dispose] = ResultOfGetMinerDetails.prototype.free;

export class ResultOfGetMultifactorDetails {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfGetMultifactorDetails.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfGetMultifactorDetailsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfGetMultifactorDetailsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofgetmultifactordetails_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_address(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {TCandidateOwnerPubkeyExpirationMap}
     */
    get candidate_new_owner_pubkey_and_expiration() {
        const ret = wasm.resultofgetmultifactordetails_candidate_new_owner_pubkey_and_expiration(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get factors_len() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_factors_len(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {TFactorsOrderedByTimestampMap}
     */
    get factors_ordered_by_timestamp() {
        const ret = wasm.resultofgetmultifactordetails_factors_ordered_by_timestamp(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get force_remove_oldest() {
        const ret = wasm.resultofgetmultifactordetails_force_remove_oldest(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {string}
     */
    get index_mod_4() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_index_mod_4(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get iss_base_64() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_iss_base_64(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {TJwkModulusDataMap}
     */
    get jwk_modulus_data() {
        const ret = wasm.resultofgetmultifactordetails_jwk_modulus_data(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get jwk_modulus_data_len() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_jwk_modulus_data_len(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get jwk_update_key() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_jwk_update_key(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get m_security_cards_len() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_m_security_cards_len(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get m_transactions_len() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_m_transactions_len(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get max_cleanup_txns() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_max_cleanup_txns(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get min_value() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_min_value(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get owner_pubkey() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_owner_pubkey(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get pub_recovery_key() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_pub_recovery_key(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get root() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_root(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {boolean}
     */
    get use_security_card() {
        const ret = wasm.resultofgetmultifactordetails_use_security_card(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {string}
     */
    get wasm_hash() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_wasm_hash(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {TWhiteListOfAddressMap}
     */
    get white_list_of_address() {
        const ret = wasm.resultofgetmultifactordetails_white_list_of_address(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get zkid() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmultifactordetails_zkid(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ResultOfGetMultifactorDetails.prototype[Symbol.dispose] = ResultOfGetMultifactorDetails.prototype.free;

export class ResultOfGetMultifactorInfo {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfGetMultifactorInfo.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfGetMultifactorInfoFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfGetMultifactorInfoFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofgetmultifactorinfo_free(ptr, 0);
    }
    /**
     * @returns {MultifactorAccountData | undefined}
     */
    get data() {
        const ret = wasm.resultofgetmultifactorinfo_data(this.__wbg_ptr);
        return ret === 0 ? undefined : MultifactorAccountData.__wrap(ret);
    }
}
if (Symbol.dispose) ResultOfGetMultifactorInfo.prototype[Symbol.dispose] = ResultOfGetMultifactorInfo.prototype.free;

export class ResultOfGetMvMultifactorAddress {
    static __wrap(ptr) {
        const obj = Object.create(ResultOfGetMvMultifactorAddress.prototype);
        obj.__wbg_ptr = ptr;
        ResultOfGetMvMultifactorAddressFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResultOfGetMvMultifactorAddressFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resultofgetmvmultifactoraddress_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.resultofgetmvmultifactoraddress_address(this.__wbg_p
