/**
 * Runs in <head> before first paint (plain ES5, no imports: it is inlined as a string).
 * Mirrors pickTheme/resolveTheme in resolve-theme.ts: ?theme param > (web only) cookie >
 * default (native=dark, web=system); system is light only if the OS asks for light.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;var c=document.cookie;var native=false;try{native=!!(window.inNativeApp||/(?:^|;\\s*)mobile-app=true/.test(c));}catch(e){}try{if(window.Android&&window.Android.postMessage){native=true;d.classList.add('native-android');}}catch(e){}if(native)d.classList.add('native-app');try{var q=location.search.match(/[?&]theme=(light|dark|system)/);var m=c.match(/(?:^|;\\s*)theme=(light|dark|system)/);var t=q?q[1]:native?'dark':m?m[1]:'system';var light=t==='light'||(t==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches);d.classList.add(light?'light':'dark');}catch(e){d.classList.add('dark');}})();`
