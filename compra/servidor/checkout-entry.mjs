// Copied by the verified integration patch beside the existing Worker modules.
// These imports deliberately resolve to the existing Data Hub, not a second source.
import {central} from './central-source.mjs';
import {readSharedHub} from './shared-hub.mjs';
import {seal, unseal} from './messenger-control.mjs';
import {CHECKOUT_CONFIG as config} from './checkout-config.mjs';
import {readCheckoutSource} from './checkout-shared-source.mjs';
import {checkoutPublic, checkoutAdmin} from './checkout-edge.mjs';
import {checkoutInit, checkoutFetch} from './checkout-store.mjs';
const sourceProvider = () => readCheckoutSource({readSharedHub, central});
export const handleCheckoutPublic = (req, env) => checkoutPublic(req, env, config);
export const handleCheckoutAdmin = (req, env) => checkoutAdmin(req, env, config);
export const initCheckoutStore = box => checkoutInit(box, config);
export const handleCheckoutStore = (path, req, box) => checkoutFetch(path, req, box, {config, sourceProvider, seal, unseal});
