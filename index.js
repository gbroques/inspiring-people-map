import * as L from "https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js";

const csvPromise = fetch('Inspiring People.csv')
    .then(r => r.text())
    .then(csvToArray)
    .then(rows => rows.filter(row => row.latitude && row.longitude));
const amtrakRoutesPromise = fetch('NTAD_Amtrak_Routes_1361372499291965491.txt')
    .then(r => r.json());
csvPromise.then(rows => {
    const home = {
        name: 'Home',
        address: 'St. Louis, Missouri',
        latitude: 38.63,
        longitude: -90.20
    };
    const map = L.map('map', {
        center: [home.latitude, home.longitude],
        zoom: 3,
        layers: [
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            })
        ]
    });
    [home, ...rows].forEach(row => addRowToMap(map, row));
    amtrakRoutesPromise.then(amtrakRoutes => addAmtrakRoutes(map, amtrakRoutes));
});
function addAmtrakRoutes(map, amtrakRoutes) {
    // Feature Collection format
    // https://developers.arcgis.com/web-map-specification/objects/featureCollection/
    const {featureSet} = amtrakRoutes.layers[0];
    let coordinatesList = featureSet.features.map(({attributes, geometry}) => ({
        name: attributes.name,
        coordinates: geometry.paths.map(path => (
            path.map(feature => {
                const [lon, lat] = feature;
                return [lat, lon]; // Leaflet expects [lat, lon]
            })))
    }));

    const polylines = coordinatesList.map(({coordinates}) => (
        L.polyline(coordinates, {
            color: 'blue',
            weight: 3,
            opacity: 0.8
        })
    ));
    const amtrakRoutesGroup = L.layerGroup(polylines);
    const overlayMaps = {'Amtrak Routes': amtrakRoutesGroup};
    const layerControl = L.control.layers(null, overlayMaps).addTo(map);
}
function addRowToMap(map, row) {
    const {latitude, longitude, name, address, url} = row;
    const options = {title: name};
    const popup = [
        `<strong>${name}</strong>`,
        address,
        url && `<a href="${url}" target="_blank">${url}</a>`
    ].filter(Boolean).join('<br />');
    L.marker([latitude, longitude], options)
        .addTo(map)
        .bindPopup(popup);
}
function csvToArray(csv) {
    const [headerLine, ...lines] = csv.split(/\r?\n/);
    const headers = headerLine.split(",");

    return lines.map((line, index) =>
        line
        /*
            ,          Split on comma
            (?=        Followed by
            (?:        Start a non-capture group
                [^"]*  0 or more non-quote characters
                "      1 quote
                [^"]*  0 or more non-quote characters
                "      1 quote
            )*         0 or more repetition of non-capture group (multiple of 2 quotes will be even)
            [^"]*      Finally 0 or more non-quotes
            $          Till the end  (This is necessary, else every comma will satisfy the condition)
        )
    */
    // https://stackoverflow.com/questions/18893390/splitting-on-comma-outside-quotes/18893443#18893443
    .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
    .reduce((object, value, index) => ({
        ...object,
        [headers[index]]: removeSurroundingDoubleQuotesIfPresent(value),
        }),
        {}
    ));
}
function removeSurroundingDoubleQuotesIfPresent(string) {
    return string.replace(/"(.*)"/, '$1');
}
