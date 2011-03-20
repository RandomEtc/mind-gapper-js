var Canvas = require('canvas'),
    fs = require('fs');

var world = JSON.parse(fs.readFileSync('110m_admin_0_countries.json','utf8'));
var colorRegions = fs.readFileSync('../data/color_regions.csv','utf8');

var w = 125,
    h =  63;

var project = {
  'Point': function(coords) {
    coords[0] = w * (coords[0] + 180.0) / 360.0;
    coords[1] = h - (h * (coords[1] + 90.0) / 180.0);
  },
 'LineString': function(coords) {
    coords.forEach(project.Point);
  },
 'Polygon': function(coords) {
    coords.forEach(project.LineString);
  },
 'MultiPolygon': function(coords) {
    coords.forEach(project.Polygon);
  },
 'Feature': function(f) {
    project[f.geometry.type](f.geometry.coordinates);
  }
}

world.features.forEach(project.Feature);

var regionsByCountryCode = {},
    regionCountryById = {},
    uniqueRegions = {},
    regions = [],
    colors = [ '#3F4FFF', '#2FBFE5', '#68FF5E', '#E5FF2F', '#FF982F', '#FF2F2F' ];

var lines = colorRegions.split('\n'),
    rows = lines.map(function(line) {
      var words = line.split(',');
      var columns = [];
      while(words.length > 0) {
        var word = words.shift();
        if (word.charAt(0) == '"') {
          while(word.charAt(word.length-1) != '"' && words.length > 0) {
            word += ','+words.shift();
          }
        }
        if (word.charAt(0) == '"' && word.charAt(word.length-1) == '"') {
          word = word.slice(1,word.length-1);
        }
        columns.push(word);
      }
      return columns;
    }),
    headers = rows.shift();

rows.forEach(function(row) {
  var group = row[1],
      name = row[0],
      id = row[2];
  if (!(group in uniqueRegions)) {
    uniqueRegions[group] = true;
    regions.push(group);
  }
  regionsByCountryCode[id] = group;
  regionCountryById[id] = name;
});

var geomByCountryCode = {};

world.features.forEach(function(f) {
  geomByCountryCode[f.properties.ISO_A2] = f.geometry;
  geomByCountryCode[f.properties.ADMIN] = f.geometry;
});

geomByCountryCode['SD'].coordinates = [ geomByCountryCode['Sudan'].coordinates, geomByCountryCode['South Sudan'].coordinates ];
geomByCountryCode['SD'].type = 'MultiPolygon';

var canvas = new Canvas(),
    ctx = canvas.getContext('2d');

canvas.width = w;
canvas.height = h;

ctx.antialias = 'none';

for (var id in regionsByCountryCode) {
  var geom = geomByCountryCode[id] || geomByCountryCode[regionCountryById[id]];
  ctx.fillStyle = colors[regions.indexOf(regionsByCountryCode[id])];
  if (geom) {
    switch(geom.type) {
      case 'Polygon':
        ctx.beginPath();
        geom.coordinates.forEach(function(ring) {
          ctx.moveTo(ring[0][0], ring[0][1]);
          ring.slice(1).forEach(function(point) {
            ctx.lineTo(point[0], point[1]);
          });
        });
        ctx.fill();
        break;
      case 'MultiPolygon':
        ctx.beginPath();
        geom.coordinates.forEach(function(polygon) {
          polygon.forEach(function(ring) {
            ctx.moveTo(ring[0][0], ring[0][1]);
            ring.slice(1).forEach(function(point) {
              ctx.lineTo(point[0], point[1]);
            });
          });
        });
        ctx.fill();
        break;
    }
  }
  else {
    console.error('no geom for %s', id);
  }
}

var out = fs.createWriteStream(__dirname + '/world.png'),
    stream = canvas.createPNGStream();

stream.on('data', function(chunk){
  out.write(chunk);
});

stream.on('end', function(){
  console.log('saved png');
});

