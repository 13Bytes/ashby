declare module "plotly.js-dist-min" {
  import Plotly from "plotly.js";
  export default Plotly;
}

declare module "react-plotly.js/factory" {
  import type { PlotParams } from "react-plotly.js";
  import type Plotly from "plotly.js";
  import type * as React from "react";

  type PlotComponent = React.ComponentType<PlotParams>;
  export default function createPlotlyComponent(plotly: typeof Plotly): PlotComponent;
}
