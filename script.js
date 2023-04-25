// NOTE: Be careful with variable naming if you make edits to this
// If you change the names or data types of attributes on the base map, you will have to make the appropriate adjustments in the code or you will break the tool.
// See README.txt for more detailed info on use and editing, or the user-guide on how you should format your webmap
// If you have questions about this code feel free to contact James Vuille-Kowing, lead developer.

//require() includes javascript modules necessary for the project.      
require([
        "esri/views/MapView",
        "esri/WebMap",
        "esri/widgets/Legend",
        "esri/widgets/Expand",
        "esri/widgets/Bookmarks",
        "esri/core/lang",
        "esri/core/promiseUtils",
        "esri/core/reactiveUtils",
        "esri/Graphic",
        "esri/layers/GraphicsLayer",
        "esri/geometry/Circle",
        "esri/widgets/TimeSlider",
        "esri/layers/FeatureLayer"
      ], (MapView, WebMap, Legend, Expand, Bookmarks, lang, promiseUtils, reactiveUtils,Graphic,GraphicsLayer,Circle,TimeSlider,FeatureLayer) => {
        
        // declare chart variables at the start
        // these are updated when the tool completes a query.
        let totalNumber, dayNumber, personRisk, totalChart,dateChart, vesselChart, vesselDateChart;

        // load a web map containing tracklines
        // from a portal item
        const webmap = new WebMap({
          portalItem: {
              id: "bb21b618c79b4bb1bf21717a82d9c6d4" //IMPORTANT: replace this string in the quotations with the id of your webmap
          }
        });
        
        // creates the view for the map
        const view = new MapView({
          map: webmap,
          container: "viewDiv",
          constraints: {
            minScale: 80000000
          },
          highlightOptions: {
            color: "black",
            haloOpacity: 0.65,
            fillOpacity: 0.45
          }
          
        });
  

        // Add UI elements to the view

        // Displays the results of a statistical query in the top right
        // And places them in an Expand widget instance (button that expands or hides the box they're place in)

        const titleContent = document.createElement("div");
        titleContent.style.padding = "15px";
        titleContent.style.backgroundColor = "white";
        titleContent.style.width = "500px";
        titleContent.innerHTML = [
          "<div id='title' class='esri-widget'>",
          "<span id='num-vessels'>0</span> vessels on average pass through the selected area per year.",
          "<span id='num-vessels-date'>0</span> vessels on average pass through between the selected days.",
          "Based on this, <span id='person-risk'>0</span> people on average would be on the water during that time.",
          "</div>"
        ].join(" ");
        
        const titleExpand = new Expand({
          expandIconClass: "esri-icon-dashboard",
          expandTooltip: "Summary stats",
          view: view,
          content: titleContent,
          expanded: view.widthBreakpoint !== "xsmall"
        });
        view.ui.add(titleExpand, "top-right");

  
        // Displays instructions to the user for understanding the sample
        // And places them in an Expand widget instance in the top left

        const sampleInstructions = document.createElement("div");
        sampleInstructions.style.padding = "10px";
        sampleInstructions.style.backgroundColor = "white";
        sampleInstructions.style.width = "300px";
        sampleInstructions.innerHTML = [
          "<b>Click</b> at a point on the map to view stats",
          "within a <b>selected radius</b> (NM) of the pointer location,",
          "or enter a desired location in the <b>lower left</b>."
        ].join(" ");

        const instructionsExpand = new Expand({
          expandIconClass: "esri-icon-question",
          expandTooltip: "How to use this sample",
          view: view,
          content: sampleInstructions
        });
        view.ui.add(instructionsExpand, "top-left");

        let highlightHandle = null;

  
        // Creates a time slider widget
        // Initializes it to be between 01 Jan 2015 and 31 Dec 2015
        // This is merely placeholder dates for controlling the behavior; data from different years is effected by it
        // Other properties are set when the layer view is loaded
  
        const start = new Date(2015, 0, 1);
        const end = new Date(2015,11,31);
        const timeSlider = new TimeSlider({
          container: "timeSliderDiv",
          //mode: "instant",
          fullTimeExtent: {
            start: start,
            end: end
          },
          playRate: 250,
          stops: {
            interval: {
              value: 1,
              unit: "days"
            }
          },
          
          
          // Changes the display for the day labels at the top of the timeslider box
          // Hides '2015' being displayed to avoid confusing the user
          // Does not effect tool functionality, only readability
          
          labelFormatFunction: (value, type, element, layout) => {
              const normal = new Intl.DateTimeFormat('en-us');
              switch (type) {
                case "min":
                  element.innerText = "Start: Jan 1st"
                  break;
                case "max":
                  element.innerText = "End: Dec 31st"
                  break;
                case "extent":
                  
                  const monthStart = (value[0].toLocaleString("default", {month:"short"}))
                  const dayStart = (value[0].toLocaleString("default", {day:"2-digit"}))
                  
                  const monthEnd = (value[1].toLocaleString("default", {month:"short"}))
                  const dayEnd = (value[1].toLocaleString("default", {day:"2-digit"}))
                  
                  if(dayStart+monthStart != dayEnd+monthEnd){
                    element.innerText = dayStart+' '+monthStart+'  -  '+dayEnd+' '+monthEnd;
                  }
                  else {
                    element.innerText = dayStart+' '+monthStart;
                  }
                  
                  break;
              }
            },
          
          
          
          // Changes the ticks below the time slider that indicate the date range being selected
          // Not important for functionality, only display
          
          tickConfigs: [{
            mode: "position",
            values: [
              new Date(2015, 0, 1), new Date(2015, 1, 1), new Date(2015, 2, 1), new Date(2015, 3, 1), new Date(2015, 4, 1), new Date(2015, 5, 1),
              new Date(2015, 6, 1), new Date(2015, 7, 1), new Date(2015, 8, 1), new Date(2015, 9, 1), new Date(2015, 10, 1), new Date(2015, 11, 1)
            ].map((date) => date.getTime()),
            labelsVisible: true,
            labelFormatFunction: (value) => {
              const date = new Date(value);
              return `${date.toLocaleString("default", {month:"short"})}`; //  This returns the month of the dates added for the timeslider's ticks
            },
            //  This CSS labeling doesn't seem to work; this is unimportant for functionality, only some minor display.
            tickCreatedFunction: (value, tickElement, labelElement) => {
              tickElement.classList.add("custom-ticks");
              labelElement.classList.add("custom-labels");
            }
          }]
        });
        
        // Adds the time slider to the bottom left of the view
        view.ui.add(timeSlider, "bottom-left");
        
        
        
        /**
         * Creates charts and start querying the layer view when
         * the view is ready and data begins to draw in the view
         */
        view.when().then(() => {
          
          // Create the charts when the view is ready
          // createCharts(); creates all the charts. See the function comments below for more details.
          createCharts();
          
          // Links variables used in the title content to the HTML info that defines them.
          totalNumber = document.getElementById("num-vessels");
          dayNumber = document.getElementById("num-vessels-date")
          personRisk = document.getElementById("person-risk")
          
          const layer = webmap.layers.getItemAt(0); // Defines the webmap's first layer as the layer to be querying. Unless multiple layers are used when creating the map, this should always be 0.
          
          // Defines the layer's time field as the one given in "BaseDateTime" attribute.
          // BaseDateTime is a date field which defines the time when a vessel's track first began.
          layer.timeInfo = {startField: "BaseDateTime",interval:{unit:"days",value:1}}; 

          // Adds the user-selected latitude, longitude, and query radius box in the lower left
          // Properties of the box are defined in the html portion of the tool
          view.ui.add("optionsDiv");
          
          
          // Creates/Adds several important components once the view is done loading
          view.whenLayerView(layer).then((layerView) => {
            reactiveUtils
              .whenOnce(() => !layerView.updating)
              .then(() => {
              
              
                  // timeExtent property is set so that time slider
                  // widget show the first day. We are setting the slider's thumb positions.
                  timeSlider.timeExtent = {start, end};
                  
                  // Creates an event that watches for changes in the time slider's date range
                  // Any tracklines which did not happen between this date range are grayed out
                  // This is done by comparing the track's attribute "MonthDay" to the time slider's thumb positions
                  timeSlider.watch("timeExtent", () => {
                  layerView.featureEffect = {
                    filter: {
                      where:"MonthDay BETWEEN " + timeSlider.timeExtent.start.toLocaleString("default", {
                  month:"2-digit"}) + timeSlider.timeExtent.start.toLocaleString("default", {
                  day:"2-digit"}) + " AND " + timeSlider.timeExtent.end.toLocaleString("default", {
                  month:"2-digit"}) + timeSlider.timeExtent.end.toLocaleString("default", {
                  day:"2-digit"})
                    },
                    excludedEffect: "grayscale(20%) opacity(0%)" // stops displaying features (tracks) in the filter
                  };
                    
                  });
              

                // Query layer view statistics upon a user click
                
                // Defines which attribute fields for the tracks may be used for the stat query
                // If an attribute is not included here, any stat query referencing that attribute will fail
                layer.outFields = ["year","MonthDay","yearMonthDay","VesselType","MMSI"];
                
                // Watches for user click on 'Do Query' button in the Latitude/Longitude/Radius box
                // When the user clicks 'Do Query', executes the doQuery function, which completes a stat query
                // using the user input latitude, longitude, and radius
                document.getElementById("doBtn").addEventListener("click", doQuery);  
              
                // Watches for user click on screen; behaves like doQuery, but calls a seperate function queryStatsOnClick
                view.on(["click"], (event) => {
                  
                  // disables attribute query for clicked on items; purely for display purposes.
                  event.stopPropagation();
                  
                  // Calls queryStatsOnClick, which is like doQuery but instead of using a user input lat and long
                  // it uses the location the user clicks on the map to perform the query. Still uses the user input radius from the options box
                  queryStatsOnClick(layerView,event)
                    .then(updateCharts)
                    .catch((error) => {
                      if (error.name !== "AbortError") {
                        console.error(error);
                      }
                    });
                });
             });
          });
        });
        
        // the doQuery function called when a user selects 'Do Query' in the lower left.
        
        function doQuery() {

          const layer = webmap.layers.getItemAt(0);
          view.whenLayerView(layer).then((layerView) => {
          
            
            var latitude = document.getElementById("lat"); // retrieves user input latitude
            var longitude = document.getElementById("lon"); // retrieves user input longitude
            var userRadius = document.getElementById("rad"); // retrieves user input radius
            
            
            // Creates a circle const for on click highlight; it is added to the view in the query so the center can be defined.
            // Adds a circle visually at the user selected point to give an idea of what objects fall in the query
            
            view.graphics.removeAll(); //removes the previous circle from the view
            
            // Defines the circle's geometric properties
            var circleGeometry = new Circle({
              center: [longitude.value,latitude.value], //long and lat
              geodesic: true,
              numberOfPoints: 100,
              radius: userRadius.value,
              radiusUnit: "nautical-miles"
            });
            
            // Defines circle's aesthetic properties and adds it to the view
            view.graphics.add(new Graphic({
              geometry: circleGeometry,
              symbol: {
                type: "simple-fill",
                style: "circle",
                outline: {
                  width: 3,
                  color: "black"
                }
              }
            }));

            // Creates a map point from user input lat and lon
            const mapPoint = {
              x: longitude.value, 
              y: latitude.value,
              spatialReference:{
                  wkid: 4326
              }
          };
            

          // Turns user selected map point into a screen point
          const screenPoint = view.toScreen(mapPoint);

          // create a query object for the highlight and the statistics query
          const query = layerView.layer.createQuery();
            
          query.geometry = view.toMap(screenPoint); // converts the screen point to a map point, allowing a user selected lat and lon to be placed correctly
          query.distance = userRadius.value; // Defines the query radius as the value of the user-selected radius
          query.units = "nautical-miles";

          const statsQuery = query.clone();

          // Create the statistic definitions for querying stats from the layer view
          // the 'onStatisticField' property can reference a field name (attribute) or a SQL expression
          // 'outStatisticFieldName' is the name of the statistic you will reference in the result, like a variable name
          // 'statisticType' can be sum, avg, min, max, count, stddev
          const statDefinitions = [
            
            // Total statistics
            
            {
              onStatisticField: "CASE WHEN year = '2015' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2015",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2016' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2016",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2017' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2017",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2018' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2018",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2019' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2019",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2020' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2020",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2021' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2021",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2022' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2022",
              statisticType: "sum",
            },
            
            
            // Statistics by Date Range
            
            
            {
              onStatisticField: "CASE WHEN MonthDay BETWEEN " + timeSlider.timeExtent.start.toLocaleString("default", {
                  month:"2-digit"}) + timeSlider.timeExtent.start.toLocaleString("default", {
                  day:"2-digit"}) + " AND " + timeSlider.timeExtent.end.toLocaleString("default", {
                  month:"2-digit"}) + timeSlider.timeExtent.end.toLocaleString("default", {
                  day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total_DateRange",
              statisticType: "sum"
            },
            
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2015, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2015, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2015Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2016, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2016, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2016Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2017, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2017, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2017Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2018, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2018, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2018Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2019, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2019, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2019Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2020, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2020, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2020Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2021, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2021, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2021Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2022, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2022, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2022Date",
              statisticType: "sum",
            },
            
            
            // Vessel type statistics
            
            {
              onStatisticField: "CASE WHEN VesselType = 'Small Craft' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalSmallCraft",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Not Specifed' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalNotSpecifed",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Fishing' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalFishing",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Tug/PortTender' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalTug",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Cargo/Tanker' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalCargo",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Passenger Vessel' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalPassenger",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Towing' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalTow",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Pilot' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalPilot",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Govt Vessel' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalGovt",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Diving Ops' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalDive",
              statisticType: "sum",
            },
          ];
          
          // adds the stat definitions to the the statistics query object cloned earlier
          statsQuery.outStatistics = statDefinitions;
            
          // groups the results of the query by unique MMSI
          statsQuery.groupByFieldsForStatistics = ["MMSI"];

          // executes the query for all features in the layer view
          const allStatsResponse = layerView.queryFeatures(statsQuery).then(
            (response) => {
              const stats = response.features; //returns array containing results of query
              return stats;
            },
            (e) => {
              console.error(e);
            }
          );


          // highlight all features within the query distance
          // Commented out as an aesthetic choice
          /*
          layerView.queryObjectIds(query).then((ids) => {
            if (highlightHandle) {
              highlightHandle.remove();
              highlightHandle = null;
            }
            highlightHandle = layerView.highlight(ids);
          });
          */

          // Return the promises that will resolve to each set of statistics
           promiseUtils.eachAlways([allStatsResponse]).then(updateCharts);
        });
        };
  
  
        
        // queryStatsOnClick is functionally identically to doQuery, except it is called when a 'click' screen event is observed rather than pressing the Do Query button
        // used for when a user queries by clicking the screen
        
        const queryStatsOnClick = promiseUtils.debounce((layerView,event) => {
          
          
          var userRadius = document.getElementById("rad"); // retrieves user input radius for determining circle and query size
          
          // adds a circle visually at the user selected point to give an idea of what objects fall in the query
          view.graphics.removeAll(); //removes all current circles
          const mapPointHighlight = view.toMap(event)
          var circleGeometry = new Circle({
            center: [mapPointHighlight.longitude,mapPointHighlight.latitude], //long and lat
            geodesic: true,
            numberOfPoints: 100,
            radius: userRadius.value,
            radiusUnit: "nautical-miles"
          });
          
          view.graphics.add(new Graphic({
            geometry: circleGeometry,
            symbol: {
              type: "simple-fill",
              style: "circle",
              outline: {
                width: 3,
                color: "black"
              }
            }
          }));

          
          // create a query object for the highlight and the statistics query
          const query = layerView.layer.createQuery();
          query.geometry = view.toMap(event); // converts the screen point to a map point, allowing a user selected lat and lon to be placed correctly
          query.distance = userRadius.value; // queries all features within the user-selected nautical mile radius
          query.units = "nautical-miles";

          const statsQuery = query.clone();

          // Create the statistic definitions for querying stats from the layer view
          // the 'onStatisticField' property can reference a field name (attribute) or a SQL expression
          // 'outStatisticFieldName' is the name of the statistic you will reference in the result, like a variable name
          // 'statisticType' can be sum, avg, min, max, count, stddev
          const statDefinitions = [
            
            // Total statistics
            
            {
              onStatisticField: "CASE WHEN year = '2015' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2015",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2016' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2016",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2017' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2017",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2018' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2018",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2019' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2019",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2020' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2020",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2021' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2021",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN year = '2022' THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2022",
              statisticType: "sum",
            },
            
            
            // Statistics by Date Range
            
            
            {
              onStatisticField: "CASE WHEN MonthDay BETWEEN " + timeSlider.timeExtent.start.toLocaleString("default", {
                  month:"2-digit"}) + timeSlider.timeExtent.start.toLocaleString("default", {
                  day:"2-digit"}) + " AND " + timeSlider.timeExtent.end.toLocaleString("default", {
                  month:"2-digit"}) + timeSlider.timeExtent.end.toLocaleString("default", {
                  day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total_DateRange",
              statisticType: "sum"
            },
            
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2015, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2015, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2015Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2016, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2016, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2016Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2017, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2017, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2017Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2018, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2018, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2018Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2019, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2019, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2019Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2020, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2020, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2020Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2021, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2021, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2021Date",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN yearMonthDay BETWEEN " + (new Date(Date.UTC(2022, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.start.toLocaleString("default", {day:"2-digit"}) + 
              " AND " + (new Date(Date.UTC(2022, 1, 0, 0, 0, 0))).toLocaleString("default", {year:"numeric"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {month:"2-digit"}) + 
              timeSlider.timeExtent.end.toLocaleString("default", {day:"2-digit"})+" THEN 1 ELSE 0 END",
              outStatisticFieldName: "total2022Date",
              statisticType: "sum",
            },
            
            
            // Vessel type statistics
            
            {
              onStatisticField: "CASE WHEN VesselType = 'Small Craft' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalSmallCraft",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Not Specifed' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalNotSpecifed",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Fishing' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalFishing",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Tug/PortTender' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalTug",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Cargo/Tanker' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalCargo",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Passenger Vessel' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalPassenger",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Towing' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalTow",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Pilot' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalPilot",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Govt Vessel' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalGovt",
              statisticType: "sum",
            },
            {
              onStatisticField: "CASE WHEN VesselType = 'Diving Ops' THEN 1 ELSE 0 END",
              outStatisticFieldName: "totalDive",
              statisticType: "sum",
            },
          ];
          
          // add the stat definitions to the the statistics query object cloned earlier
          statsQuery.outStatistics = statDefinitions;
          //groups by unique MMSI
          statsQuery.groupByFieldsForStatistics = ["MMSI"];

          // execute the query for all features in the layer view
          const allStatsResponse = layerView.queryFeatures(statsQuery).then(
            (response) => {
              const stats = response.features; //returns array containing results of query
              return stats;
            },
            (e) => {
              console.error(e);
            }
          );


          // highlight all features within the query distance
          // commented out for aesthetics
          /*
          layerView.queryObjectIds(query).then((ids) => {
            if (highlightHandle) {
              highlightHandle.remove();
              highlightHandle = null;
            }
            highlightHandle = layerView.highlight(ids);
          });
          */

          // Return the promises that will resolve to each set of statistics
          return promiseUtils.eachAlways([allStatsResponse]);
        });

  
  
  
        // updateCharts is called whenever a query executes, and it updates the charts on the right with the query info
        function updateCharts(responses) {
          
          const allStats = responses[0].value; //retrieves first index of the passed array, which contains all the query info. '.value' retrieves only the MMSI components of the array.

          // Declares a series of variables that will be used to compute chart info
          
          let total2015_sum = 0
          let total2016_sum = 0
          let total2017_sum = 0
          let total2018_sum = 0
          let total2019_sum = 0
          let total2020_sum = 0
          let total2021_sum = 0
          let total2022_sum = 0
          
          
          let date_sum = 0
          let totalSmallCraft_sum = 0
          let totalNotSpecifed_sum = 0
          let totalFishing_sum = 0
          let totalTug_sum = 0
          let totalCargo_sum = 0
          let totalPassenger_sum = 0
          let totalTow_sum = 0
          let totalPilot_sum = 0
          let totalGovt_sum = 0
          let totalDive_sum = 0
          
          let total2015Date_sum = 0
          let total2016Date_sum = 0
          let total2017Date_sum = 0
          let total2018Date_sum = 0
          let total2019Date_sum = 0
          let total2020Date_sum = 0
          let total2021Date_sum = 0
          let total2022Date_sum = 0
          
          let totalSmallCraftDate_sum = 0
          let totalNotSpecifedDate_sum = 0
          let totalFishingDate_sum = 0
          let totalTugDate_sum = 0
          let totalCargoDate_sum = 0
          let totalPassengerDate_sum = 0
          let totalTowDate_sum = 0
          let totalPilotDate_sum = 0
          let totalGovtDate_sum = 0
          let totalDiveDate_sum = 0
          
          
          // Iterates through every unique MMSI and checks the status of each of their attributes
          // If a paticular attribute is greater than 0, that means the conditions for it to be counted in the stat query occurred at least once
          // Thus the variable defined above that represents that info is incremented by 1.
          
          allStats.forEach(item => {
            
            // Statistic calculations for total
            
            if(item.attributes.total2015 > 0)
            {
              total2015_sum += 1
            };
            if(item.attributes.total2016 > 0)
            {
              total2016_sum += 1
            };
            if(item.attributes.total2017 > 0)
            {
              total2017_sum += 1
            };
            if(item.attributes.total2018 > 0)
            {
              total2018_sum += 1
            };
            if(item.attributes.total2019 > 0)
            {
              total2019_sum += 1
            };
            if(item.attributes.total2020 > 0)
            {
              total2020_sum += 1
            };
            if(item.attributes.total2021 > 0)
            {
              total2021_sum += 1
            };
            if(item.attributes.total2022 > 0)
            {
              total2022_sum += 1
            };
            
            // Statistic calulations for date range
            
            if(item.attributes.total2015Date > 0)
            {
              total2015Date_sum += 1
            };
            if(item.attributes.total2016Date > 0)
            {
              total2016Date_sum += 1
            };
            if(item.attributes.total2017Date > 0)
            {
              total2017Date_sum += 1
            };
            if(item.attributes.total2018Date > 0)
            {
              total2018Date_sum += 1
            };
            if(item.attributes.total2019Date > 0)
            {
              total2019Date_sum += 1
            };
            if(item.attributes.total2020Date > 0)
            {
              total2020Date_sum += 1
            };
            if(item.attributes.total2021Date > 0)
            {
              total2021Date_sum += 1
            };
            if(item.attributes.total2022Date > 0)
            {
              total2022Date_sum += 1
            };
            
            
            // Statistic calculation for vessel types
            
            if(item.attributes.totalSmallCraft > 0)
            {
              totalSmallCraft_sum += 1
            };
            if(item.attributes.totalNotSpecifed > 0)
            {
              totalNotSpecifed_sum += 1
            };
            if(item.attributes.totalFishing > 0)
            {
              totalFishing_sum += 1
            };
            if(item.attributes.totalTug > 0)
            {
              totalTug_sum += 1
            };
            if(item.attributes.totalCargo > 0)
            {
              totalCargo_sum += 1
            };
            if(item.attributes.totalPassenger > 0)
            {
              totalPassenger_sum += 1
            };
            if(item.attributes.totalTow > 0)
            {
              totalTow_sum += 1
            };
            if(item.attributes.totalPilot > 0)
            {
              totalPilot_sum += 1
            };
            if(item.attributes.totalGovt > 0)
            {
              totalGovt_sum += 1
            };
            if(item.attributes.totalDive > 0)
            {
              totalDive_sum += 1
            };
            
            // Statistic calculation for vessel type that fall in date range
            
            if(item.attributes.total_DateRange > 0)
            {
              
              if(item.attributes.totalSmallCraft > 0)
                {
                  totalSmallCraftDate_sum += 1
                };
                if(item.attributes.totalNotSpecifed > 0)
                {
                  totalNotSpecifedDate_sum += 1
                };
                if(item.attributes.totalFishing > 0)
                {
                  totalFishingDate_sum += 1
                };
                if(item.attributes.totalTug > 0)
                {
                  totalTugDate_sum += 1
                };
                if(item.attributes.totalCargo > 0)
                {
                  totalCargoDate_sum += 1
                };
                if(item.attributes.totalPassenger > 0)
                {
                  totalPassengerDate_sum += 1
                };
                if(item.attributes.totalTow > 0)
                {
                  totalTowDate_sum += 1
                };
                if(item.attributes.totalPilot > 0)
                {
                  totalPilotDate_sum += 1
                };
                if(item.attributes.totalGovt > 0)
                {
                  totalGovtDate_sum += 1
                };
                if(item.attributes.totalDive > 0)
                {
                  totalDiveDate_sum += 1
                };
            
            }
          });
          
          
          
          // The following block takes the statistics calculated in the previous blocks and updates the charts with them
          
          const totalStats = [
            total2015_sum, total2016_sum,
            total2017_sum, total2018_sum,
            total2019_sum, total2020_sum,
            total2021_sum, total2022_sum
          ];
          updateChart(totalChart, totalStats);
          
          const dateStats = [
            total2015Date_sum, total2016Date_sum,
            total2017Date_sum, total2018Date_sum,
            total2019Date_sum, total2020Date_sum,
            total2021Date_sum, total2022Date_sum
          ];
          updateChart(dateChart, dateStats);
          
          const vesselStats = [
            totalCargo_sum, totalFishing_sum,
            totalGovt_sum, totalTow_sum,
            totalDive_sum, totalPilot_sum,
            totalSmallCraft_sum, totalTug_sum,
            totalPassenger_sum, totalNotSpecifed_sum
          ];
          updateChart(vesselChart, vesselStats);
          
          const vesselDateStats = [
            totalCargoDate_sum, totalFishingDate_sum,
            totalGovtDate_sum, totalTowDate_sum,
            totalDiveDate_sum, totalPilotDate_sum,
            totalSmallCraftDate_sum, totalTugDate_sum,
            totalPassengerDate_sum, totalNotSpecifedDate_sum
          ];
          updateChart(vesselDateChart, vesselDateStats);
          
          
          // Updates each of the title card elements
          // Each of these is rounded up to the nearest whole number
          // Additional info on each must be specified in the HTML block to ensure they are created and update correctly
          
          // Average # of vessels per year that will pass through an area
          totalNumber.innerHTML = Math.ceil((total2015_sum+total2016_sum
                                  +total2017_sum+total2018_sum
                                  +total2019_sum+total2020_sum
                                  +total2021_sum+total2022_sum
                                  )/8); //divided by # of years in order to return yearly average; 8 in this case. Same goes for dayNumber and personRisk
          
          // Average # of vessels per year that will pass through an area in a user-specified date range
          dayNumber.innerHTML = Math.ceil((total2015Date_sum+total2016Date_sum
                                  +total2017Date_sum+total2018Date_sum
                                  +total2019Date_sum+total2020Date_sum
                                  +total2021Date_sum+total2022Date_sum
                                  )/8);
          
          // Average # of people that will be on board said vessels within the user-specified date range
          // Numbers for expected passengers for each vessel type are multiplied by the count of each vessel type
          // Numbers for expected passengers were determine by referencing the Codes of Federal Regulations (CFR), specifically 46 CFR Chapter I -- Coast Guard Department of Homeland Security.
          // Additionally, we adjusted some numbers based on the user input of our sponsor, LTJG Rachel Samotis at Coast Guard PACAREA
          personRisk.innerHTML = Math.ceil(((totalCargoDate_sum*20)+(totalFishingDate_sum*20)
            +(totalGovtDate_sum*150)+(totalTowDate_sum*7)
            +(totalDiveDate_sum*60)+(totalPilotDate_sum*2)
            +(totalSmallCraftDate_sum*35)+(totalTugDate_sum*75)
            +(totalPassengerDate_sum*50)+(totalNotSpecifedDate_sum*12))/8);

        }
        
        

        // Updates the given chart with new data fed to the function by updateCharts
        function updateChart(chart, dataValues) {
          chart.data.datasets[0].data = dataValues;
          chart.update();
        }
        
        
        
        // createCharts defines the properties for all the charts that are then updated later
        // This mostly includes formatting, with all th numbers set to 0 by default
        // Additional chart info must be defined in the HTML block to ensure they are created correctly
        
        function createCharts() {
          
          const totalCanvas = document.getElementById("total-chart");
          totalChart = new Chart(totalCanvas.getContext("2d"), {
            type: "bar",
            data: {
              labels: ["2015", "2016", "2017","2018","2019","2020","2021","2022"],
              datasets: [
                {
                  label: "Vessels",
                  backgroundColor: "#ed5050",
                  stack: "Stack 0",
                  data: [0, 0, 0, 0, 0, 0, 0, 0]
                },
              ]
            },
            options: {
              responsive: false,
              legend: {
                position: "top"
              },
              title: {
                display: true,
                text: "# Vessels by Year"
              },
              scales: {
                xAxes: [
                  {
                    stacked: true
                  }
                ],
                yAxes: [
                  {
                    stacked: true,
                    ticks: {
                      beginAtZero: true
                    }
                  }
                ]
              }
            }
          });
          
          const dateCanvas = document.getElementById("date-chart");
          dateChart = new Chart(dateCanvas.getContext("2d"), {
            type: "bar",
            data: {
              labels: ["2015", "2016", "2017","2018","2019","2020","2021","2022"],
              datasets: [
                {
                  label: "Vessels: Date Range",
                  backgroundColor: "#149dcf",
                  stack: "Stack 0",
                  data: [0, 0, 0, 0, 0, 0, 0, 0]
                },
              ]
            },
            options: {
              responsive: false,
              legend: {
                position: "top"
              },
              title: {
                display: true,
                text: "# Vessels by Year: Date Range"
              },
              scales: {
                xAxes: [
                  {
                    stacked: true
                  }
                ],
                yAxes: [
                  {
                    stacked: true,
                    ticks: {
                      beginAtZero: true
                    }
                  }
                ]
              }
            }
          });
        
          
          
        const vesselCanvas = document.getElementById("vessel-chart");
          vesselChart = new Chart(vesselCanvas.getContext("2d"), {
            type: "doughnut",
            data: {
              labels: ["Cargo/Tanker", "Fishing","Government","Towing","Diving","Pilot","Small Craft","Port Tender","Passenger","Not Specified"],
              datasets: [
                {
                  backgroundColor: ["#149dcf", "#a6c736", "#ed5050","#d11aff","#ffbf00","#00e6b8","#ffff66","#cc6699","#ff6600","#004d99"],
                  borderColor: "rgb(255, 255, 255)",
                  borderWidth: 1,
                  data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                }
              ]
            },
            options: {
              responsive: false,
              cutoutPercentage: 35,
              legend: {
                position: "bottom"
              },
              title: {
                display: true,
                text: "Vessel Types"
              }
            }
          });
          
        const vesselDateCanvas = document.getElementById("vessel-date-chart");
          vesselDateChart = new Chart(vesselDateCanvas.getContext("2d"), {
            type: "doughnut",
            data: {
              labels: ["Cargo/Tanker", "Fishing","Government","Towing","Diving","Pilot","Small Craft","Port Tender","Passenger","Not Specified"],
              datasets: [
                {
                  backgroundColor: ["#149dcf", "#a6c736", "#ed5050","#d11aff","#ffbf00","#00e6b8","#ffff66","#cc6699","#ff6600","#004d99"],
                  borderColor: "rgb(255, 255, 255)",
                  borderWidth: 1,
                  data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                }
              ]
            },
            options: {
              responsive: false,
              cutoutPercentage: 35,
              legend: {
                position: "bottom"
              },
              title: {
                display: true,
                text: "Vessel Types: Date Range"
              }
            }
          });
          
          
        }

      });