import { Text, View } from "react-native";
import { colors } from "../src/theme";

const MapScreen = () => {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.text }}>Misty</Text>
    </View>
  );
};

export default MapScreen;
