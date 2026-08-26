/**
 * @file openvpn3_rs.h
 * @brief C-ABI bindings for the pure-Rust openvpn3-rs native library.
 */

#ifndef OPENVPN3_RS_H
#define OPENVPN3_RS_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Return Error Codes */
#define OVPN_SUCCESS               0
#define OVPN_ERR_NULL_PTR         -1
#define OVPN_ERR_INVALID_CONFIG   -2
#define OVPN_ERR_SESSION_FAILED   -3
#define OVPN_ERR_PANIC            -4
#define OVPN_ERR_INVALID_UTF8     -5

/* Event Types */
#define OVPN_EVENT_STATE_CHANGED        1
#define OVPN_EVENT_NETWORK_CONFIGURED   2
#define OVPN_EVENT_AUTH_CHALLENGE       3
#define OVPN_EVENT_STATS_UPDATED        4
#define OVPN_EVENT_DISCONNECTED         5
#define OVPN_EVENT_ERROR                6

/**
 * @brief Opaque handle to parsed OpenVPN configuration.
 */
typedef struct ovpn_config_t ovpn_config_t;

/**
 * @brief Opaque handle to active OpenVPN client session.
 */
typedef struct ovpn_session_t ovpn_session_t;

/**
 * @brief Session traffic and runtime metrics snapshot.
 */
typedef struct {
    uint64_t bytes_in;
    uint64_t bytes_out;
    uint64_t packets_in;
    uint64_t packets_out;
    uint64_t uptime_seconds;
} ovpn_stats_t;

/**
 * @brief Callback function type for asynchronous session events.
 */
typedef void (*ovpn_event_callback_t)(int32_t event_type, const char* json_payload, void* user_data);

/**
 * @brief Returns the version string of openvpn3-rs.
 */
const char* ovpn_version(void);

/**
 * @brief Parses an OpenVPN profile (.ovpn text).
 */
int32_t ovpn_config_parse(const char* ovpn_text, ovpn_config_t** out_config);

/**
 * @brief Frees a parsed configuration handle.
 */
void ovpn_config_free(ovpn_config_t* config);

/**
 * @brief Creates a client session instance.
 */
int32_t ovpn_session_create(ovpn_config_t* config, ovpn_event_callback_t callback, void* user_data, ovpn_session_t** out_session);

/**
 * @brief Starts the asynchronous connection pipeline.
 */
int32_t ovpn_session_start(ovpn_session_t* session);

/**
 * @brief Stops and disconnects the session.
 */
int32_t ovpn_session_stop(ovpn_session_t* session);

/**
 * @brief Submits a dynamic challenge response token (e.g. OTP).
 */
int32_t ovpn_session_submit_challenge(ovpn_session_t* session, const char* state_id, const char* response);

/**
 * @brief Queries real-time session throughput metrics.
 */
int32_t ovpn_session_get_stats(ovpn_session_t* session, ovpn_stats_t* out_stats);

/**
 * @brief Destroys and frees the session handle.
 */
void ovpn_session_free(ovpn_session_t* session);

#ifdef __cplusplus
}
#endif

#endif /* OPENVPN3_RS_H */
