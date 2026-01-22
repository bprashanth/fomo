# Event Processing in the DashboardComponent 

The processing of events can get complicated in this frontend, so here's a rundown. 

The first entry point is when the user types a alasql query: 
```
User types SQL -> SchemaPanel (execute) -> DashboardComponent -> ALL Panels (broadcast)
```
The second, is when they choose a template from the `DataViewer`
```
Template Selected -> DashboardComponent -> SchemaPanel (execute) -> DashboardComponent -> Target Panel
```

In both cases the schema panel emits `query-result-updated`
* In the first case, this is directly consumed as a broadcast type prop by all sub-panels. All the dashboard component does is transfer this emitted event into queryResult. 
* In the second case, this is emitted event is transferred to a template which targets a single subpanel. 
