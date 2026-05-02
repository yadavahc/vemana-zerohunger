'use client';

import React from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629 // Center of India, fallback
};

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  icon?: string;
}

export interface MapComponentProps {
  markers?: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  trackingRoute?: { lat: number; lng: number }[];
  height?: string;
}

export default function MapComponent({ 
  markers = [], 
  center, 
  zoom = 12,
  trackingRoute = [],
  height = '400px'
}: MapComponentProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  });

  const mapCenter = center || (markers.length > 0 ? { lat: markers[0].lat, lng: markers[0].lng } : defaultCenter);

  const [map, setMap] = React.useState<google.maps.Map | null>(null);

  const onLoad = React.useCallback(function callback(map: google.maps.Map) {
    if (markers.length > 0 && !center) {
        const bounds = new window.google.maps.LatLngBounds();
        markers.forEach(marker => {
            bounds.extend(new window.google.maps.LatLng(marker.lat, marker.lng));
        });
        map.fitBounds(bounds);
    }
    setMap(map);
  }, [markers, center]);

  const onUnmount = React.useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  if (!isLoaded) return <div className={`w-full bg-slate-100 flex items-center justify-center`} style={{ height }}>Loading Maps...</div>;

  return (
    <div style={{ height, width: '100%' }} className="rounded-xl overflow-hidden shadow-sm border border-gray-100">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
            disableDefaultUI: false,
            zoomControl: true,
        }}
      >
        {/* Child components, such as markers, info windows, etc. */}
        {markers.map(marker => (
            <Marker key={marker.id} position={{ lat: marker.lat, lng: marker.lng }} title={marker.title} />
        ))}
        {trackingRoute.length > 0 && (
            <Polyline
                path={trackingRoute}
                options={{
                    strokeColor: "#1D9E75",
                    strokeOpacity: 1.0,
                    strokeWeight: 4,
                }}
            />
        )}
      </GoogleMap>
    </div>
  );
}
