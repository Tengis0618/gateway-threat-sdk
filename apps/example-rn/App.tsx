import React, { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { GatewayPay, type PaymentResponse } from "@gateway/pay-react-native";
import { env } from "./env.generated";

export default function App() {
    const pay = useMemo(
        () =>
            new GatewayPay({
                apiKey: env.GATEWAY_API_KEY || "pk_sandbox_demo",
                environment: env.GATEWAY_ENVIRONMENT === "production" ? "production" : "sandbox",
                baseUrl: env.GATEWAY_BASE_URL,
                ...(env.GATEWAY_HEADER_PREFIX && { headerPrefix: env.GATEWAY_HEADER_PREFIX }),
                webCheckoutUrl: env.GATEWAY_WEB_CHECKOUT_URL,
            }),
        [],
    );

    const [status, setStatus] = useState<string>("Idle");
    const [busy, setBusy] = useState(false);

    const onPress = async () => {
        setBusy(true);
        setStatus("Contacting gateway…");
        try {
            const response: PaymentResponse = await pay.authorize({
                reference: `DEMO-${Date.now()}`,
                total: { currency: "USD", amount: 999 },
                countryCode: "US",
                description: "Demo coffee",
            });
            setStatus(JSON.stringify(response, null, 2));
        } catch (err) {
            setStatus(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
            <StatusBar barStyle="dark-content" />
            <ScrollView contentContainerStyle={{ padding: 24 }}>
                <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: 8 }}>Gateway Pay demo</Text>
                <Text style={{ marginBottom: 24, color: "#555" }}>
                    Pay $9.99 via Apple Pay (iOS) or the gateway web checkout (Android fallback).
                </Text>
                <TouchableOpacity
                    onPress={onPress}
                    disabled={busy}
                    style={{
                        backgroundColor: busy ? "#666" : "#000",
                        borderRadius: 8,
                        paddingVertical: 14,
                        alignItems: "center",
                    }}
                >
                    <Text style={{ color: "white", fontSize: 16, fontWeight: "500" }}>
                        {busy ? "Working…" : "Pay with Apple Pay"}
                    </Text>
                </TouchableOpacity>
                <View
                    style={{
                        marginTop: 24,
                        padding: 16,
                        borderRadius: 8,
                        backgroundColor: "#f0f0f0",
                    }}
                >
                    <Text style={{ fontFamily: "Menlo", fontSize: 12 }}>{status}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
