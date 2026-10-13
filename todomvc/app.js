import { mount, createRouter } from "../framework/index.js";
import { store, setRoute } from "./actions.js";
import { view } from "./view.js";

// the URL (#/, #/active, #/completed) decides which todos are shown
createRouter(setRoute);

mount(view, document.getElementById("root"), store);
