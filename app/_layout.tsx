import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";
import { migrateDbIfNeeded } from "../src/db/schema";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="misty.db" onInit={migrateDbIfNeeded}>
      <StatusBar style="light" />
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
    </SQLiteProvider>
  );
}
  