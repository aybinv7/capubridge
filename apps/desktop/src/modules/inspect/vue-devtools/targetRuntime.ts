import userAppBundle from "@vue/devtools-electron/dist/user-app.iife.js?raw";

export const TARGET_BINDING_NAME = "__capubridgeVueDevtoolsBinding";
export const TARGET_RECEIVE_NAME = "__capubridgeVueDevtoolsReceive";
export const TARGET_READY_FLAG = "__capubridgeVueDevtoolsReady";
export const TARGET_INSTALLED_FLAG = "__capubridgeVueDevtoolsInstalled";
export const PROXY_TO_SERVER_SOURCE = "proxy->server";
export const SERVER_TO_PROXY_SOURCE = "server->proxy";

export function buildTargetRuntimeSource() {
  const shim = `var __capubridgeGlobal=typeof globalThis!=="undefined"?globalThis:window;if(!__capubridgeGlobal.process)__capubridgeGlobal.process={env:{NODE_ENV:"production"}};if(!__capubridgeGlobal.process.env)__capubridgeGlobal.process.env={NODE_ENV:"production"};if(!__capubridgeGlobal.process.env.NODE_ENV)__capubridgeGlobal.process.env.NODE_ENV="production";var process=__capubridgeGlobal.process;`;
  const replacement = `function j3(){var t=typeof globalThis!=="undefined"?globalThis:window;var b=${JSON.stringify(TARGET_BINDING_NAME)};var v=${JSON.stringify(TARGET_RECEIVE_NAME)};var p=${JSON.stringify(PROXY_TO_SERVER_SOURCE)};var h=${JSON.stringify(SERVER_TO_PROXY_SOURCE)};var k1="__capubridgeVueDevtoolsProxyListener";var k2="__capubridgeVueDevtoolsServerForwarder";function e(i){try{if(i&&typeof i==="object"&&typeof i.t==="string")return i;if(typeof i!=="string")i=JSON.stringify(i);var n=JSON.parse(i);if(n&&typeof n==="object"){if(typeof n.t==="string")return n;if("json" in n){var r=n.json;if(r&&typeof r==="object"&&typeof r.t==="string")return r}}}catch(o){return null}}function s(i){try{return JSON.stringify(i)}catch(o){return""}}function n(i){if(typeof i!=="string"){i=s(i)}if(!i)return;t[b](i)}function r(){return{post:function(i){if(!i||typeof i!=="object"||typeof i.t!=="string")return;t.postMessage({source:h,payload:s(i)},"*")},on:function(i){t[v]=function(o){var a=e(o);if(a&&typeof a.t==="string")i(a)};if(!t[k1]){t[k1]=!0;t.addEventListener("message",function(o){var a=o&&o.data;if(!a||a.source!==p)return;var l=e(a.payload);if(l&&typeof l.t==="string")i(l)})}if(!t[k2]){t[k2]=!0;t.addEventListener("message",function(o){var a=o&&o.data;if(!a||a.source!==h)return;n(a.payload)})}}}}var g1=${JSON.stringify(TARGET_INSTALLED_FLAG)};function d(){var o={};o[${JSON.stringify(TARGET_READY_FLAG)}]=!0;n(o)}if(t[g1]){d();return}t[g1]=!0;_t.init();o0(uv,{channel:r()});uv.initDevToolsServerListener();d()}j3();`;
  const patchedBundle = userAppBundle.replace(
    /function j3\(t\)\{[\s\S]*?j3\(K3\.default\);/,
    replacement,
  );

  if (patchedBundle === userAppBundle) {
    throw new Error("Failed to patch official Vue DevTools runtime");
  }

  return `${shim}${patchedBundle}`;
}
