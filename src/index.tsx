import "./index.css";
import { render } from "react-dom";
import { App } from "./App";
import { keepFocusedFieldVisible } from "./utils/keepFocusedFieldVisible";

keepFocusedFieldVisible();

render(<App />, document.getElementById("root"));
