import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { colors } from "../src/theme";

const RootLayout = () => {
  return (
    <>
      <StatusBar />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
};

export default RootLayout;
