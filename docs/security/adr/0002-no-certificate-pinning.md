# ADR 0002: No certificate pinning in v0.1

**Status:** Accepted

## Context

Pinning can reduce the risk from a mis-issued certificate. However, browsers don't offer a pinning API to web code, so it could only apply to iOS and React Native. Pins in shipped apps also fail hard: if a certificate rotates before merchants ship an update, every payment in that app stops working.

## Decision

v0.1 doesn't pin certificates. The SDKs rely on platform TLS validation: browser defaults on the web and App Transport Security on iOS, with no exceptions. The SDKs reject non-HTTPS base URLs, except loopback addresses for development.

## Consequences

- Certificate rotation can't break integrated apps.
- An attacker able to install a root certificate on a device can intercept that device's traffic. This doesn't weaken Apple Pay's encrypted token, and that attacker already controls the customer's device (see the residual risks in [THREAT-MODEL.md](../THREAT-MODEL.md)).

## Revisit when

A production gateway is available with a backup pin and rotation process, and a kill switch that can disable pinning remotely.
