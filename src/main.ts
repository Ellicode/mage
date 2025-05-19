import { createApp } from "vue";
import App from "./App.vue";

import "./style.css";
import VueLatex from "vatex";

import "./demos/ipc";
// If you want use Node.js, the`nodeIntegration` needs to be enabled in the Main process.
// import './demos/node'

createApp(App)
    .use(VueLatex)
    .mount("#app")
    .$nextTick(() => {
        postMessage({ payload: "removeLoading" }, "*");
    });
