var map = new L.Map('map', { 
	center: new L.LatLng(-37.19533, 144.94262), 
	zoom: 6, 
	attributionControl:true, 
	zoomControl:true, 
	minZoom:6
}); 
var pano = null;
function initialize() {
	var loc = new google.maps.LatLng(-37.815395,144.967175)

	// Set up the map
	var mapOptions = {
		center: loc,
		zoom: 18,
		streetViewControl: false
	};
	gmap = new google.maps.Map(document.getElementById('sv-map'),
	  mapOptions);

	pano = gmap.getStreetView();
	pano.setPosition(loc);
	pano.setPov(/** @type {google.maps.StreetViewPov} */({
		heading: 265,
		pitch: 0
	}));
	pano.setVisible(true);
}

google.maps.event.addDomListener(window, 'load', initialize);

 //http://api.maps.vic.gov.au/vicmapapi/map/wms?LAYERS=CARTOGRAPHICAL&FORMAT=image%2Fpng&FIRSTTILE=true&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&STYLES=&SRS=EPSG%3A3111&BBOX=2869735.5008043,2539132.2495979,3140669.3760054,2810066.124799&WIDTH=512&HEIGHT=512

var vicmap = L.tileLayer.wms("http://api.maps.vic.gov.au/geowebcacheWM/service/wms?", {
    layers: 'WEB_MERCATOR',
    format: 'image/png',
    transparent: true,
    attribution: "BaseMap © <a href=http://api.maps.vic.gov.au/vicmapapi/Copyright.jsp>VicMap</a>",
    maxNativeZoom: 18
});

map.addLayer(vicmap,true)

var baseMaps = {
    "VicMap": vicmap
};

var crashes = null;
var crashdensity = null;

//crashes		
cartodb.createLayer(map, 'https://alexgleith.cartodb.com/api/v2/viz/6d47b918-38b4-11e5-a653-0e4fddd5de28/viz.json',{ legends: false })
	//.addTo(map)
	.on('done', function(layer) {
    	crashes = layer;
      	layer.setZIndex(1);
      	layer.minZoom = 12;
      	layer.maxZoom = 14;
      	layer.getSubLayer(0).on('featureClick', function(e, latlng, pos, data) {
      		//openStreetview(latlng);
      		getNearby(latlng);
  		})
	});

//density
cartodb.createLayer(map, 'https://alexgleith.cartodb.com/api/v2/viz/8ec21008-38b8-11e5-b9da-0e018d66dc29/viz.json',{ legends: false })
	.addTo(map)
	.on('done', function(layer) {
    	crashdensity = layer;
      	layer.setZIndex(1);
	});

var overlayMaps = {};

L.control.layers(baseMaps, overlayMaps).addTo(map);

function openStreetViewMarkers (centre, locations) {
	var lng = centre[0];
	var lat = centre[1];

	var loc = new google.maps.LatLng(lng, lat);

	// Setup the markers on the map
	for (var i = locations.length - 1; i >= 0; i--) {
		var data = locations[i];
		var oneLoc = new google.maps.LatLng(data.y, data.x);
		var oneMarker = new google.maps.Marker({
		  position: oneLoc,
		  map: gmap,
		  icon: 'http://chart.apis.google.com/chart?chst=d_map_pin_icon&chld=car|'+getColour(data.severity),
		  title: data.crash,
		  id: data.cartodb_id+','+data.x+','+data.y
		});
		google.maps.event.addListener(oneMarker, 'click', function() {
	    	openCrash(oneMarker.id);
  		});
	};

	pano = gmap.getStreetView();
	pano.setPosition(loc);
	pano.setPov(/** @type {google.maps.StreetViewPov} */({
	heading: 265,
	pitch: 0
	}));
	pano.setVisible(true);

	var streetViewService = new google.maps.StreetViewService();
	var STREETVIEW_MAX_DISTANCE = 100;
	var loc = new google.maps.LatLng(lng,lat);
	streetViewService.getPanoramaByLocation(loc, STREETVIEW_MAX_DISTANCE, function (streetViewPanoramaData, status) {
	    if (status === google.maps.StreetViewStatus.OK) {
				$("#sv-map").removeClass('hidden');
				google.maps.event.trigger(gmap, 'resize');
	    } else {
	        // no street view available in this range, or some error occurred
				$("#sv-map").addClass('hidden');
	    }
	});
}

function toggleStreetView() {
  var toggle = pano.getVisible();
  if (toggle == false) {
    panorama.setVisible(true);
  } else {
    panorama.setVisible(false);
  }
}

function getNearby(ll) {
	var lng = ll[1];
	var lat = ll[0];
	var query = "SELECT cartodb_id, crash, date, description, severity, ST_X(the_geom) as x, ST_Y(the_geom) as y from (SELECT *, ST_Distance(the_geom::geography,CDB_LatLng("+lat+","+lng+")::geography) AS dist FROM vicrash order by dist asc) as sq where dist < 250 limit 10"
	$('#loadHere').empty();
	$.getJSON('https://alexgleith.cartodb.com/api/v2/sql/?q='+query, function(data) {
	  $.each(data.rows, function(key, val) {
	  	$('#loadHere').append(
	      '<tr>' +
	        '<td>' + val.crash+ '</td>' +
	        '<td>' + val.date  + '</td>' +
	        '<td>' + val.description + '</td>' +
	        '<td class="'+getClass(val.severity)+'">' + val.severity + '</td>' +			        
	        '<td>' + '<a href="#" class="location-item" id="'+val.cartodb_id+','+val.x+','+val.y+'">Zoom to</a>' + '</td>' +
	    '</tr>')
	  });
	  openStreetViewMarkers(ll, data.rows)
	});
}

function openCrash(id) {
	var splt = id.split(',');
	var cid = splt[0];
	var lon = splt[2];
	var lat = splt[1];
  	crashes.trigger('featureClick', null, [lon,lat], null, { cartodb_id: 65319 },0)
}

$(document).on("click", ".location-item", function(e) {
	openCrash($(this).attr("id"))
});

function getClass(severity) {
	if(severity === "Fatal accident") {
		return "danger";
	} else if (severity === "Serious injury accident") {
		return "warning";
	} else {
		return "";
	}
}
function getColour(severity) {
	if(severity === "Fatal accident") {
		return "B40903";
	} else if (severity === "Serious injury accident") {
		return "FF6600";
	} else {
		return "FFCC00";
	}
}

//crashes.trigger('featureClick', null, [ll.lat,ll.lng], null, { cartodb_id: 65319 },0)
var densityOn = true;

map.on('zoomend', function() {
    var zoom = map.getZoom();
    if(zoom > 13) {
    	if(densityOn) {
    		map.removeLayer(crashdensity);
    		map.addLayer(crashes);
    		densityOn = false
    	}
    } else {
    	if(densityOn === false) {
    		map.removeLayer(crashes);
    		map.addLayer(crashdensity);
    		densityOn = true;
    	}
    }
});