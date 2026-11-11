import { useEffect, useState } from "react";
import { AppState, Linking, StyleSheet } from "react-native";
import * as Location from "expo-location";
import MapView from "react-native-maps";
import { CenteredMessage } from "../src/components/CenteredMessage";

type Coords = {
  latitude: number;
  longitude: number;
};

type State =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error" }
  | { status: "ready"; position: Coords };

export default function MapScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState({ status: "loading" });

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) {
          return;
        }
        if (!permission.granted) {
          setState({ status: "denied" });
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) {
          return;
        }

        setState({
          status: "ready",
          position: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
        });
      } catch {
        if (!cancelled) {
          setState({ status: "error" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Re-check the permission when the user comes back from the system settings.
  useEffect(() => {
    if (state.status !== "denied") {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setAttempt((value) => value + 1);
      }
    });

    return () => subscription.remove();
  }, [state.status]);

  if (state.status === "denied") {
    return (
      <CenteredMessage
        title="Misty a besoin de ta position"
        message="Sans elle, impossible de dissiper le brouillard là où tu marches."
        actionLabel="Ouvrir les réglages"
        onAction={() => Linking.openSettings()}
      />
    );
  }

  if (state.status === "error") {
    return (
      <CenteredMessage
        title="Impossible de te localiser"
        message="Vérifie que les services de localisation sont activés, puis réessaie."
        actionLabel="Réessayer"
        onAction={() => setAttempt((value) => value + 1)}
      />
    );
  }

  if (state.status === "loading") {
    return <CenteredMessage loading title="Recherche du signal GPS…" />;
  }

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        ...state.position,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }}
      showsUserLocation
      userInterfaceStyle="dark"
    />
  );
}

const styles = StyleSheet.create({
  map: StyleSheet.absoluteFill,
});
