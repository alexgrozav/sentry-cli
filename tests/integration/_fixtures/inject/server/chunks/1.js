exports.id = 1;
exports.ids = [1];
exports.modules = {

/***/ 4787:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

const SENTRY_API_VERSION = '7';

/** Returns the prefix to construct Sentry ingestion API endpoints. */
function getBaseApiEndpoint(dsn) {
  const protocol = dsn.protocol ? `${dsn.protocol}:` : '';
  const port = dsn.port ? `:${dsn.port}` : '';
  return `${protocol}//${dsn.host}${port}${dsn.path ? `/${dsn.path}` : ''}/api/`;
}

/** Returns the ingest API endpoint for target. */
function _getIngestEndpoint(dsn) {
  return `${getBaseApiEndpoint(dsn)}${dsn.projectId}/envelope/`;
}

/** Returns a URL-encoded string with auth config suitable for a query string. */
function _encodedAuth(dsn, sdkInfo) {
  return utils.urlEncode({
    // We send only the minimum set of required information. See
    // https://github.com/getsentry/sentry-javascript/issues/2572.
    sentry_key: dsn.publicKey,
    sentry_version: SENTRY_API_VERSION,
    ...(sdkInfo && { sentry_client: `${sdkInfo.name}/${sdkInfo.version}` }),
  });
}

/**
 * Returns the envelope endpoint URL with auth in the query string.
 *
 * Sending auth as part of the query string and not as custom HTTP headers avoids CORS preflight requests.
 */
function getEnvelopeEndpointWithUrlEncodedAuth(
  dsn,
  // TODO (v8): Remove `tunnelOrOptions` in favor of `options`, and use the substitute code below
  // options: ClientOptions = {} as ClientOptions,
  tunnelOrOptions = {} ,
) {
  // TODO (v8): Use this code instead
  // const { tunnel, _metadata = {} } = options;
  // return tunnel ? tunnel : `${_getIngestEndpoint(dsn)}?${_encodedAuth(dsn, _metadata.sdk)}`;

  const tunnel = typeof tunnelOrOptions === 'string' ? tunnelOrOptions : tunnelOrOptions.tunnel;
  const sdkInfo =
    typeof tunnelOrOptions === 'string' || !tunnelOrOptions._metadata ? undefined : tunnelOrOptions._metadata.sdk;

  return tunnel ? tunnel : `${_getIngestEndpoint(dsn)}?${_encodedAuth(dsn, sdkInfo)}`;
}

/** Returns the url to the report dialog endpoint. */
function getReportDialogEndpoint(
  dsnLike,
  dialogOptions

,
) {
  const dsn = utils.makeDsn(dsnLike);
  const endpoint = `${getBaseApiEndpoint(dsn)}embed/error-page/`;

  let encodedOptions = `dsn=${utils.dsnToString(dsn)}`;
  for (const key in dialogOptions) {
    if (key === 'dsn') {
      continue;
    }

    if (key === 'user') {
      const user = dialogOptions.user;
      if (!user) {
        continue;
      }
      if (user.name) {
        encodedOptions += `&name=${encodeURIComponent(user.name)}`;
      }
      if (user.email) {
        encodedOptions += `&email=${encodeURIComponent(user.email)}`;
      }
    } else {
      encodedOptions += `&${encodeURIComponent(key)}=${encodeURIComponent(dialogOptions[key] )}`;
    }
  }

  return `${endpoint}?${encodedOptions}`;
}

exports.getEnvelopeEndpointWithUrlEncodedAuth = getEnvelopeEndpointWithUrlEncodedAuth;
exports.getReportDialogEndpoint = getReportDialogEndpoint;
//# sourceMappingURL=api.js.map


/***/ }),

/***/ 5231:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const api = __webpack_require__(4787);
const envelope = __webpack_require__(3460);
const integration = __webpack_require__(9756);
const session = __webpack_require__(6636);
const prepareEvent = __webpack_require__(698);

const ALREADY_SEEN_ERROR = "Not capturing exception because it's already been captured.";

/**
 * Base implementation for all JavaScript SDK clients.
 *
 * Call the constructor with the corresponding options
 * specific to the client subclass. To access these options later, use
 * {@link Client.getOptions}.
 *
 * If a Dsn is specified in the options, it will be parsed and stored. Use
 * {@link Client.getDsn} to retrieve the Dsn at any moment. In case the Dsn is
 * invalid, the constructor will throw a {@link SentryException}. Note that
 * without a valid Dsn, the SDK will not send any events to Sentry.
 *
 * Before sending an event, it is passed through
 * {@link BaseClient._prepareEvent} to add SDK information and scope data
 * (breadcrumbs and context). To add more custom information, override this
 * method and extend the resulting prepared event.
 *
 * To issue automatically created events (e.g. via instrumentation), use
 * {@link Client.captureEvent}. It will prepare the event and pass it through
 * the callback lifecycle. To issue auto-breadcrumbs, use
 * {@link Client.addBreadcrumb}.
 *
 * @example
 * class NodeClient extends BaseClient<NodeOptions> {
 *   public constructor(options: NodeOptions) {
 *     super(options);
 *   }
 *
 *   // ...
 * }
 */
class BaseClient {
  /** Options passed to the SDK. */

  /** The client Dsn, if specified in options. Without this Dsn, the SDK will be disabled. */

  /** Array of set up integrations. */
   __init() {this._integrations = {};}

  /** Indicates whether this client's integrations have been set up. */
   __init2() {this._integrationsInitialized = false;}

  /** Number of calls being processed */
   __init3() {this._numProcessing = 0;}

  /** Holds flushable  */
   __init4() {this._outcomes = {};}

  /**
   * Initializes this client instance.
   *
   * @param options Options for the client.
   */
   constructor(options) {BaseClient.prototype.__init.call(this);BaseClient.prototype.__init2.call(this);BaseClient.prototype.__init3.call(this);BaseClient.prototype.__init4.call(this);
    this._options = options;
    if (options.dsn) {
      this._dsn = utils.makeDsn(options.dsn);
      const url = api.getEnvelopeEndpointWithUrlEncodedAuth(this._dsn, options);
      this._transport = options.transport({
        recordDroppedEvent: this.recordDroppedEvent.bind(this),
        ...options.transportOptions,
        url,
      });
    } else {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('No DSN provided, client will not do anything.');
    }
  }

  /**
   * @inheritDoc
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
   captureException(exception, hint, scope) {
    // ensure we haven't captured this very object before
    if (utils.checkOrSetAlreadyCaught(exception)) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(ALREADY_SEEN_ERROR);
      return;
    }

    let eventId = hint && hint.event_id;

    this._process(
      this.eventFromException(exception, hint)
        .then(event => this._captureEvent(event, hint, scope))
        .then(result => {
          eventId = result;
        }),
    );

    return eventId;
  }

  /**
   * @inheritDoc
   */
   captureMessage(
    message,
    // eslint-disable-next-line deprecation/deprecation
    level,
    hint,
    scope,
  ) {
    let eventId = hint && hint.event_id;

    const promisedEvent = utils.isPrimitive(message)
      ? this.eventFromMessage(String(message), level, hint)
      : this.eventFromException(message, hint);

    this._process(
      promisedEvent
        .then(event => this._captureEvent(event, hint, scope))
        .then(result => {
          eventId = result;
        }),
    );

    return eventId;
  }

  /**
   * @inheritDoc
   */
   captureEvent(event, hint, scope) {
    // ensure we haven't captured this very object before
    if (hint && hint.originalException && utils.checkOrSetAlreadyCaught(hint.originalException)) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(ALREADY_SEEN_ERROR);
      return;
    }

    let eventId = hint && hint.event_id;

    this._process(
      this._captureEvent(event, hint, scope).then(result => {
        eventId = result;
      }),
    );

    return eventId;
  }

  /**
   * @inheritDoc
   */
   captureSession(session$1) {
    if (!this._isEnabled()) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('SDK not enabled, will not capture session.');
      return;
    }

    if (!(typeof session$1.release === 'string')) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('Discarded session because of missing or non-string release');
    } else {
      this.sendSession(session$1);
      // After sending, we set init false to indicate it's not the first occurrence
      session.updateSession(session$1, { init: false });
    }
  }

  /**
   * @inheritDoc
   */
   getDsn() {
    return this._dsn;
  }

  /**
   * @inheritDoc
   */
   getOptions() {
    return this._options;
  }

  /**
   * @see SdkMetadata in @sentry/types
   *
   * @return The metadata of the SDK
   */
   getSdkMetadata() {
    return this._options._metadata;
  }

  /**
   * @inheritDoc
   */
   getTransport() {
    return this._transport;
  }

  /**
   * @inheritDoc
   */
   flush(timeout) {
    const transport = this._transport;
    if (transport) {
      return this._isClientDoneProcessing(timeout).then(clientFinished => {
        return transport.flush(timeout).then(transportFlushed => clientFinished && transportFlushed);
      });
    } else {
      return utils.resolvedSyncPromise(true);
    }
  }

  /**
   * @inheritDoc
   */
   close(timeout) {
    return this.flush(timeout).then(result => {
      this.getOptions().enabled = false;
      return result;
    });
  }

  /**
   * Sets up the integrations
   */
   setupIntegrations() {
    if (this._isEnabled() && !this._integrationsInitialized) {
      this._integrations = integration.setupIntegrations(this._options.integrations);
      this._integrationsInitialized = true;
    }
  }

  /**
   * Gets an installed integration by its `id`.
   *
   * @returns The installed integration or `undefined` if no integration with that `id` was installed.
   */
   getIntegrationById(integrationId) {
    return this._integrations[integrationId];
  }

  /**
   * @inheritDoc
   */
   getIntegration(integration) {
    try {
      return (this._integrations[integration.id] ) || null;
    } catch (_oO) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn(`Cannot retrieve integration ${integration.id} from the current Client`);
      return null;
    }
  }

  /**
   * @inheritDoc
   */
   addIntegration(integration$1) {
    integration.setupIntegration(integration$1, this._integrations);
  }

  /**
   * @inheritDoc
   */
   sendEvent(event, hint = {}) {
    if (this._dsn) {
      let env = envelope.createEventEnvelope(event, this._dsn, this._options._metadata, this._options.tunnel);

      for (const attachment of hint.attachments || []) {
        env = utils.addItemToEnvelope(
          env,
          utils.createAttachmentEnvelopeItem(
            attachment,
            this._options.transportOptions && this._options.transportOptions.textEncoder,
          ),
        );
      }

      this._sendEnvelope(env);
    }
  }

  /**
   * @inheritDoc
   */
   sendSession(session) {
    if (this._dsn) {
      const env = envelope.createSessionEnvelope(session, this._dsn, this._options._metadata, this._options.tunnel);
      this._sendEnvelope(env);
    }
  }

  /**
   * @inheritDoc
   */
   recordDroppedEvent(reason, category, _event) {
    // Note: we use `event` in replay, where we overwrite this hook.

    if (this._options.sendClientReports) {
      // We want to track each category (error, transaction, session, replay_event) separately
      // but still keep the distinction between different type of outcomes.
      // We could use nested maps, but it's much easier to read and type this way.
      // A correct type for map-based implementation if we want to go that route
      // would be `Partial<Record<SentryRequestType, Partial<Record<Outcome, number>>>>`
      // With typescript 4.1 we could even use template literal types
      const key = `${reason}:${category}`;
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`Adding outcome: "${key}"`);

      // The following works because undefined + 1 === NaN and NaN is falsy
      this._outcomes[key] = this._outcomes[key] + 1 || 1;
    }
  }

  /** Updates existing session based on the provided event */
   _updateSessionFromEvent(session$1, event) {
    let crashed = false;
    let errored = false;
    const exceptions = event.exception && event.exception.values;

    if (exceptions) {
      errored = true;

      for (const ex of exceptions) {
        const mechanism = ex.mechanism;
        if (mechanism && mechanism.handled === false) {
          crashed = true;
          break;
        }
      }
    }

    // A session is updated and that session update is sent in only one of the two following scenarios:
    // 1. Session with non terminal status and 0 errors + an error occurred -> Will set error count to 1 and send update
    // 2. Session with non terminal status and 1 error + a crash occurred -> Will set status crashed and send update
    const sessionNonTerminal = session$1.status === 'ok';
    const shouldUpdateAndSend = (sessionNonTerminal && session$1.errors === 0) || (sessionNonTerminal && crashed);

    if (shouldUpdateAndSend) {
      session.updateSession(session$1, {
        ...(crashed && { status: 'crashed' }),
        errors: session$1.errors || Number(errored || crashed),
      });
      this.captureSession(session$1);
    }
  }

  /**
   * Determine if the client is finished processing. Returns a promise because it will wait `timeout` ms before saying
   * "no" (resolving to `false`) in order to give the client a chance to potentially finish first.
   *
   * @param timeout The time, in ms, after which to resolve to `false` if the client is still busy. Passing `0` (or not
   * passing anything) will make the promise wait as long as it takes for processing to finish before resolving to
   * `true`.
   * @returns A promise which will resolve to `true` if processing is already done or finishes before the timeout, and
   * `false` otherwise
   */
   _isClientDoneProcessing(timeout) {
    return new utils.SyncPromise(resolve => {
      let ticked = 0;
      const tick = 1;

      const interval = setInterval(() => {
        if (this._numProcessing == 0) {
          clearInterval(interval);
          resolve(true);
        } else {
          ticked += tick;
          if (timeout && ticked >= timeout) {
            clearInterval(interval);
            resolve(false);
          }
        }
      }, tick);
    });
  }

  /** Determines whether this SDK is enabled and a valid Dsn is present. */
   _isEnabled() {
    return this.getOptions().enabled !== false && this._dsn !== undefined;
  }

  /**
   * Adds common information to events.
   *
   * The information includes release and environment from `options`,
   * breadcrumbs and context (extra, tags and user) from the scope.
   *
   * Information that is already present in the event is never overwritten. For
   * nested objects, such as the context, keys are merged.
   *
   * @param event The original event.
   * @param hint May contain additional information about the original exception.
   * @param scope A scope containing event metadata.
   * @returns A new event with more information.
   */
   _prepareEvent(event, hint, scope) {
    const options = this.getOptions();
    const integrations = Object.keys(this._integrations);
    if (!hint.integrations && integrations.length > 0) {
      hint.integrations = integrations;
    }
    return prepareEvent.prepareEvent(options, event, hint, scope);
  }

  /**
   * Processes the event and logs an error in case of rejection
   * @param event
   * @param hint
   * @param scope
   */
   _captureEvent(event, hint = {}, scope) {
    return this._processEvent(event, hint, scope).then(
      finalEvent => {
        return finalEvent.event_id;
      },
      reason => {
        if ((typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__)) {
          // If something's gone wrong, log the error as a warning. If it's just us having used a `SentryError` for
          // control flow, log just the message (no stack) as a log-level log.
          const sentryError = reason ;
          if (sentryError.logLevel === 'log') {
            utils.logger.log(sentryError.message);
          } else {
            utils.logger.warn(sentryError);
          }
        }
        return undefined;
      },
    );
  }

  /**
   * Processes an event (either error or message) and sends it to Sentry.
   *
   * This also adds breadcrumbs and context information to the event. However,
   * platform specific meta data (such as the User's IP address) must be added
   * by the SDK implementor.
   *
   *
   * @param event The event to send to Sentry.
   * @param hint May contain additional information about the original exception.
   * @param scope A scope containing event metadata.
   * @returns A SyncPromise that resolves with the event or rejects in case event was/will not be send.
   */
   _processEvent(event, hint, scope) {
    const options = this.getOptions();
    const { sampleRate } = options;

    if (!this._isEnabled()) {
      return utils.rejectedSyncPromise(new utils.SentryError('SDK not enabled, will not capture event.', 'log'));
    }

    const isTransaction = isTransactionEvent(event);
    const isError = isErrorEvent(event);
    const eventType = event.type || 'error';
    const beforeSendLabel = `before send for type \`${eventType}\``;

    // 1.0 === 100% events are sent
    // 0.0 === 0% events are sent
    // Sampling for transaction happens somewhere else
    if (isError && typeof sampleRate === 'number' && Math.random() > sampleRate) {
      this.recordDroppedEvent('sample_rate', 'error', event);
      return utils.rejectedSyncPromise(
        new utils.SentryError(
          `Discarding event because it's not included in the random sample (sampling rate = ${sampleRate})`,
          'log',
        ),
      );
    }

    const dataCategory = eventType === 'replay_event' ? 'replay' : eventType;

    return this._prepareEvent(event, hint, scope)
      .then(prepared => {
        if (prepared === null) {
          this.recordDroppedEvent('event_processor', dataCategory, event);
          throw new utils.SentryError('An event processor returned `null`, will not send event.', 'log');
        }

        const isInternalException = hint.data && (hint.data ).__sentry__ === true;
        if (isInternalException) {
          return prepared;
        }

        const result = processBeforeSend(options, prepared, hint);
        return _validateBeforeSendResult(result, beforeSendLabel);
      })
      .then(processedEvent => {
        if (processedEvent === null) {
          this.recordDroppedEvent('before_send', dataCategory, event);
          throw new utils.SentryError(`${beforeSendLabel} returned \`null\`, will not send event.`, 'log');
        }

        const session = scope && scope.getSession();
        if (!isTransaction && session) {
          this._updateSessionFromEvent(session, processedEvent);
        }

        // None of the Sentry built event processor will update transaction name,
        // so if the transaction name has been changed by an event processor, we know
        // it has to come from custom event processor added by a user
        const transactionInfo = processedEvent.transaction_info;
        if (isTransaction && transactionInfo && processedEvent.transaction !== event.transaction) {
          const source = 'custom';
          processedEvent.transaction_info = {
            ...transactionInfo,
            source,
            changes: [
              ...transactionInfo.changes,
              {
                source,
                // use the same timestamp as the processed event.
                timestamp: processedEvent.timestamp ,
                propagations: transactionInfo.propagations,
              },
            ],
          };
        }

        this.sendEvent(processedEvent, hint);
        return processedEvent;
      })
      .then(null, reason => {
        if (reason instanceof utils.SentryError) {
          throw reason;
        }

        this.captureException(reason, {
          data: {
            __sentry__: true,
          },
          originalException: reason ,
        });
        throw new utils.SentryError(
          `Event processing pipeline threw an error, original event will not be sent. Details have been sent as a new event.\nReason: ${reason}`,
        );
      });
  }

  /**
   * Occupies the client with processing and event
   */
   _process(promise) {
    this._numProcessing++;
    void promise.then(
      value => {
        this._numProcessing--;
        return value;
      },
      reason => {
        this._numProcessing--;
        return reason;
      },
    );
  }

  /**
   * @inheritdoc
   */
   _sendEnvelope(envelope) {
    if (this._transport && this._dsn) {
      this._transport.send(envelope).then(null, reason => {
        (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error('Error while sending event:', reason);
      });
    } else {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error('Transport disabled');
    }
  }

  /**
   * Clears outcomes on this client and returns them.
   */
   _clearOutcomes() {
    const outcomes = this._outcomes;
    this._outcomes = {};
    return Object.keys(outcomes).map(key => {
      const [reason, category] = key.split(':') ;
      return {
        reason,
        category,
        quantity: outcomes[key],
      };
    });
  }

  /**
   * @inheritDoc
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types

}

/**
 * Verifies that return value of configured `beforeSend` or `beforeSendTransaction` is of expected type, and returns the value if so.
 */
function _validateBeforeSendResult(
  beforeSendResult,
  beforeSendLabel,
) {
  const invalidValueError = `${beforeSendLabel} must return \`null\` or a valid event.`;
  if (utils.isThenable(beforeSendResult)) {
    return beforeSendResult.then(
      event => {
        if (!utils.isPlainObject(event) && event !== null) {
          throw new utils.SentryError(invalidValueError);
        }
        return event;
      },
      e => {
        throw new utils.SentryError(`${beforeSendLabel} rejected with ${e}`);
      },
    );
  } else if (!utils.isPlainObject(beforeSendResult) && beforeSendResult !== null) {
    throw new utils.SentryError(invalidValueError);
  }
  return beforeSendResult;
}

/**
 * Process the matching `beforeSendXXX` callback.
 */
function processBeforeSend(
  options,
  event,
  hint,
) {
  const { beforeSend, beforeSendTransaction } = options;

  if (isErrorEvent(event) && beforeSend) {
    return beforeSend(event, hint);
  }

  if (isTransactionEvent(event) && beforeSendTransaction) {
    return beforeSendTransaction(event, hint);
  }

  return event;
}

function isErrorEvent(event) {
  return event.type === undefined;
}

function isTransactionEvent(event) {
  return event.type === 'transaction';
}

exports.BaseClient = BaseClient;
//# sourceMappingURL=baseclient.js.map


/***/ }),

/***/ 3460:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

/**
 * Apply SdkInfo (name, version, packages, integrations) to the corresponding event key.
 * Merge with existing data if any.
 **/
function enhanceEventWithSdkInfo(event, sdkInfo) {
  if (!sdkInfo) {
    return event;
  }
  event.sdk = event.sdk || {};
  event.sdk.name = event.sdk.name || sdkInfo.name;
  event.sdk.version = event.sdk.version || sdkInfo.version;
  event.sdk.integrations = [...(event.sdk.integrations || []), ...(sdkInfo.integrations || [])];
  event.sdk.packages = [...(event.sdk.packages || []), ...(sdkInfo.packages || [])];
  return event;
}

/** Creates an envelope from a Session */
function createSessionEnvelope(
  session,
  dsn,
  metadata,
  tunnel,
) {
  const sdkInfo = utils.getSdkMetadataForEnvelopeHeader(metadata);
  const envelopeHeaders = {
    sent_at: new Date().toISOString(),
    ...(sdkInfo && { sdk: sdkInfo }),
    ...(!!tunnel && { dsn: utils.dsnToString(dsn) }),
  };

  const envelopeItem =
    'aggregates' in session ? [{ type: 'sessions' }, session] : [{ type: 'session' }, session];

  return utils.createEnvelope(envelopeHeaders, [envelopeItem]);
}

/**
 * Create an Envelope from an event.
 */
function createEventEnvelope(
  event,
  dsn,
  metadata,
  tunnel,
) {
  const sdkInfo = utils.getSdkMetadataForEnvelopeHeader(metadata);

  /*
    Note: Due to TS, event.type may be `replay_event`, theoretically.
    In practice, we never call `createEventEnvelope` with `replay_event` type,
    and we'd have to adjut a looot of types to make this work properly.
    We want to avoid casting this around, as that could lead to bugs (e.g. when we add another type)
    So the safe choice is to really guard against the replay_event type here.
  */
  const eventType = event.type && event.type !== 'replay_event' ? event.type : 'event';

  enhanceEventWithSdkInfo(event, metadata && metadata.sdk);

  const envelopeHeaders = utils.createEventEnvelopeHeaders(event, sdkInfo, tunnel, dsn);

  // Prevent this data (which, if it exists, was used in earlier steps in the processing pipeline) from being sent to
  // sentry. (Note: Our use of this property comes and goes with whatever we might be debugging, whatever hacks we may
  // have temporarily added, etc. Even if we don't happen to be using it at some point in the future, let's not get rid
  // of this `delete`, lest we miss putting it back in the next time the property is in use.)
  delete event.sdkProcessingMetadata;

  const eventItem = [{ type: eventType }, event];
  return utils.createEnvelope(envelopeHeaders, [eventItem]);
}

exports.createEventEnvelope = createEventEnvelope;
exports.createSessionEnvelope = createSessionEnvelope;
//# sourceMappingURL=envelope.js.map


/***/ }),

/***/ 3240:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const hub = __webpack_require__(6603);

// Note: All functions in this file are typed with a return value of `ReturnType<Hub[HUB_FUNCTION]>`,
// where HUB_FUNCTION is some method on the Hub class.
//
// This is done to make sure the top level SDK methods stay in sync with the hub methods.
// Although every method here has an explicit return type, some of them (that map to void returns) do not
// contain `return` keywords. This is done to save on bundle size, as `return` is not minifiable.

/**
 * Captures an exception event and sends it to Sentry.
 *
 * @param exception An exception-like object.
 * @param captureContext Additional scope data to apply to exception event.
 * @returns The generated eventId.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
function captureException(exception, captureContext) {
  return hub.getCurrentHub().captureException(exception, { captureContext });
}

/**
 * Captures a message event and sends it to Sentry.
 *
 * @param message The message to send to Sentry.
 * @param Severity Define the level of the message.
 * @returns The generated eventId.
 */
function captureMessage(
  message,
  // eslint-disable-next-line deprecation/deprecation
  captureContext,
) {
  // This is necessary to provide explicit scopes upgrade, without changing the original
  // arity of the `captureMessage(message, level)` method.
  const level = typeof captureContext === 'string' ? captureContext : undefined;
  const context = typeof captureContext !== 'string' ? { captureContext } : undefined;
  return hub.getCurrentHub().captureMessage(message, level, context);
}

/**
 * Captures a manually created event and sends it to Sentry.
 *
 * @param event The event to send to Sentry.
 * @returns The generated eventId.
 */
function captureEvent(event, hint) {
  return hub.getCurrentHub().captureEvent(event, hint);
}

/**
 * Callback to set context information onto the scope.
 * @param callback Callback function that receives Scope.
 */
function configureScope(callback) {
  hub.getCurrentHub().configureScope(callback);
}

/**
 * Records a new breadcrumb which will be attached to future events.
 *
 * Breadcrumbs will be added to subsequent events to provide more context on
 * user's actions prior to an error or crash.
 *
 * @param breadcrumb The breadcrumb to record.
 */
function addBreadcrumb(breadcrumb) {
  hub.getCurrentHub().addBreadcrumb(breadcrumb);
}

/**
 * Sets context data with the given name.
 * @param name of the context
 * @param context Any kind of data. This data will be normalized.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setContext(name, context) {
  hub.getCurrentHub().setContext(name, context);
}

/**
 * Set an object that will be merged sent as extra data with the event.
 * @param extras Extras object to merge into current context.
 */
function setExtras(extras) {
  hub.getCurrentHub().setExtras(extras);
}

/**
 * Set key:value that will be sent as extra data with the event.
 * @param key String of extra
 * @param extra Any kind of data. This data will be normalized.
 */
function setExtra(key, extra) {
  hub.getCurrentHub().setExtra(key, extra);
}

/**
 * Set an object that will be merged sent as tags data with the event.
 * @param tags Tags context object to merge into current context.
 */
function setTags(tags) {
  hub.getCurrentHub().setTags(tags);
}

/**
 * Set key:value that will be sent as tags data with the event.
 *
 * Can also be used to unset a tag, by passing `undefined`.
 *
 * @param key String key of tag
 * @param value Value of tag
 */
function setTag(key, value) {
  hub.getCurrentHub().setTag(key, value);
}

/**
 * Updates user context information for future events.
 *
 * @param user User context object to be set in the current context. Pass `null` to unset the user.
 */
function setUser(user) {
  hub.getCurrentHub().setUser(user);
}

/**
 * Creates a new scope with and executes the given operation within.
 * The scope is automatically removed once the operation
 * finishes or throws.
 *
 * This is essentially a convenience function for:
 *
 *     pushScope();
 *     callback();
 *     popScope();
 *
 * @param callback that will be enclosed into push/popScope.
 */
function withScope(callback) {
  hub.getCurrentHub().withScope(callback);
}

/**
 * Starts a new `Transaction` and returns it. This is the entry point to manual tracing instrumentation.
 *
 * A tree structure can be built by adding child spans to the transaction, and child spans to other spans. To start a
 * new child span within the transaction or any span, call the respective `.startChild()` method.
 *
 * Every child span must be finished before the transaction is finished, otherwise the unfinished spans are discarded.
 *
 * The transaction must be finished with a call to its `.finish()` method, at which point the transaction with all its
 * finished child spans will be sent to Sentry.
 *
 * NOTE: This function should only be used for *manual* instrumentation. Auto-instrumentation should call
 * `startTransaction` directly on the hub.
 *
 * @param context Properties of the new `Transaction`.
 * @param customSamplingContext Information given to the transaction sampling function (along with context-dependent
 * default values). See {@link Options.tracesSampler}.
 *
 * @returns The transaction which was just started
 */
function startTransaction(
  context,
  customSamplingContext,
) {
  return hub.getCurrentHub().startTransaction({ ...context }, customSamplingContext);
}

exports.addBreadcrumb = addBreadcrumb;
exports.captureEvent = captureEvent;
exports.captureException = captureException;
exports.captureMessage = captureMessage;
exports.configureScope = configureScope;
exports.setContext = setContext;
exports.setExtra = setExtra;
exports.setExtras = setExtras;
exports.setTag = setTag;
exports.setTags = setTags;
exports.setUser = setUser;
exports.startTransaction = startTransaction;
exports.withScope = withScope;
//# sourceMappingURL=exports.js.map


/***/ }),

/***/ 6603:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const scope = __webpack_require__(101);
const session = __webpack_require__(6636);

/**
 * API compatibility version of this hub.
 *
 * WARNING: This number should only be increased when the global interface
 * changes and new methods are introduced.
 *
 * @hidden
 */
const API_VERSION = 4;

/**
 * Default maximum number of breadcrumbs added to an event. Can be overwritten
 * with {@link Options.maxBreadcrumbs}.
 */
const DEFAULT_BREADCRUMBS = 100;

/**
 * A layer in the process stack.
 * @hidden
 */

/**
 * @inheritDoc
 */
class Hub  {
  /** Is a {@link Layer}[] containing the client and scope */
    __init() {this._stack = [{}];}

  /** Contains the last event id of a captured event.  */

  /**
   * Creates a new instance of the hub, will push one {@link Layer} into the
   * internal stack on creation.
   *
   * @param client bound to the hub.
   * @param scope bound to the hub.
   * @param version number, higher number means higher priority.
   */
   constructor(client, scope$1 = new scope.Scope(),   _version = API_VERSION) {this._version = _version;Hub.prototype.__init.call(this);
    this.getStackTop().scope = scope$1;
    if (client) {
      this.bindClient(client);
    }
  }

  /**
   * @inheritDoc
   */
   isOlderThan(version) {
    return this._version < version;
  }

  /**
   * @inheritDoc
   */
   bindClient(client) {
    const top = this.getStackTop();
    top.client = client;
    if (client && client.setupIntegrations) {
      client.setupIntegrations();
    }
  }

  /**
   * @inheritDoc
   */
   pushScope() {
    // We want to clone the content of prev scope
    const scope$1 = scope.Scope.clone(this.getScope());
    this.getStack().push({
      client: this.getClient(),
      scope: scope$1,
    });
    return scope$1;
  }

  /**
   * @inheritDoc
   */
   popScope() {
    if (this.getStack().length <= 1) return false;
    return !!this.getStack().pop();
  }

  /**
   * @inheritDoc
   */
   withScope(callback) {
    const scope = this.pushScope();
    try {
      callback(scope);
    } finally {
      this.popScope();
    }
  }

  /**
   * @inheritDoc
   */
   getClient() {
    return this.getStackTop().client ;
  }

  /** Returns the scope of the top stack. */
   getScope() {
    return this.getStackTop().scope;
  }

  /** Returns the scope stack for domains or the process. */
   getStack() {
    return this._stack;
  }

  /** Returns the topmost scope layer in the order domain > local > process. */
   getStackTop() {
    return this._stack[this._stack.length - 1];
  }

  /**
   * @inheritDoc
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
   captureException(exception, hint) {
    const eventId = (this._lastEventId = hint && hint.event_id ? hint.event_id : utils.uuid4());
    const syntheticException = new Error('Sentry syntheticException');
    this._withClient((client, scope) => {
      client.captureException(
        exception,
        {
          originalException: exception,
          syntheticException,
          ...hint,
          event_id: eventId,
        },
        scope,
      );
    });
    return eventId;
  }

  /**
   * @inheritDoc
   */
   captureMessage(
    message,
    // eslint-disable-next-line deprecation/deprecation
    level,
    hint,
  ) {
    const eventId = (this._lastEventId = hint && hint.event_id ? hint.event_id : utils.uuid4());
    const syntheticException = new Error(message);
    this._withClient((client, scope) => {
      client.captureMessage(
        message,
        level,
        {
          originalException: message,
          syntheticException,
          ...hint,
          event_id: eventId,
        },
        scope,
      );
    });
    return eventId;
  }

  /**
   * @inheritDoc
   */
   captureEvent(event, hint) {
    const eventId = hint && hint.event_id ? hint.event_id : utils.uuid4();
    if (!event.type) {
      this._lastEventId = eventId;
    }

    this._withClient((client, scope) => {
      client.captureEvent(event, { ...hint, event_id: eventId }, scope);
    });
    return eventId;
  }

  /**
   * @inheritDoc
   */
   lastEventId() {
    return this._lastEventId;
  }

  /**
   * @inheritDoc
   */
   addBreadcrumb(breadcrumb, hint) {
    const { scope, client } = this.getStackTop();

    if (!scope || !client) return;

    const { beforeBreadcrumb = null, maxBreadcrumbs = DEFAULT_BREADCRUMBS } =
      (client.getOptions && client.getOptions()) || {};

    if (maxBreadcrumbs <= 0) return;

    const timestamp = utils.dateTimestampInSeconds();
    const mergedBreadcrumb = { timestamp, ...breadcrumb };
    const finalBreadcrumb = beforeBreadcrumb
      ? (utils.consoleSandbox(() => beforeBreadcrumb(mergedBreadcrumb, hint)) )
      : mergedBreadcrumb;

    if (finalBreadcrumb === null) return;

    scope.addBreadcrumb(finalBreadcrumb, maxBreadcrumbs);
  }

  /**
   * @inheritDoc
   */
   setUser(user) {
    const scope = this.getScope();
    if (scope) scope.setUser(user);
  }

  /**
   * @inheritDoc
   */
   setTags(tags) {
    const scope = this.getScope();
    if (scope) scope.setTags(tags);
  }

  /**
   * @inheritDoc
   */
   setExtras(extras) {
    const scope = this.getScope();
    if (scope) scope.setExtras(extras);
  }

  /**
   * @inheritDoc
   */
   setTag(key, value) {
    const scope = this.getScope();
    if (scope) scope.setTag(key, value);
  }

  /**
   * @inheritDoc
   */
   setExtra(key, extra) {
    const scope = this.getScope();
    if (scope) scope.setExtra(key, extra);
  }

  /**
   * @inheritDoc
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
   setContext(name, context) {
    const scope = this.getScope();
    if (scope) scope.setContext(name, context);
  }

  /**
   * @inheritDoc
   */
   configureScope(callback) {
    const { scope, client } = this.getStackTop();
    if (scope && client) {
      callback(scope);
    }
  }

  /**
   * @inheritDoc
   */
   run(callback) {
    const oldHub = makeMain(this);
    try {
      callback(this);
    } finally {
      makeMain(oldHub);
    }
  }

  /**
   * @inheritDoc
   */
   getIntegration(integration) {
    const client = this.getClient();
    if (!client) return null;
    try {
      return client.getIntegration(integration);
    } catch (_oO) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn(`Cannot retrieve integration ${integration.id} from the current Hub`);
      return null;
    }
  }

  /**
   * @inheritDoc
   */
   startTransaction(context, customSamplingContext) {
    return this._callExtensionMethod('startTransaction', context, customSamplingContext);
  }

  /**
   * @inheritDoc
   */
   traceHeaders() {
    return this._callExtensionMethod('traceHeaders');
  }

  /**
   * @inheritDoc
   */
   captureSession(endSession = false) {
    // both send the update and pull the session from the scope
    if (endSession) {
      return this.endSession();
    }

    // only send the update
    this._sendSessionUpdate();
  }

  /**
   * @inheritDoc
   */
   endSession() {
    const layer = this.getStackTop();
    const scope = layer && layer.scope;
    const session$1 = scope && scope.getSession();
    if (session$1) {
      session.closeSession(session$1);
    }
    this._sendSessionUpdate();

    // the session is over; take it off of the scope
    if (scope) {
      scope.setSession();
    }
  }

  /**
   * @inheritDoc
   */
   startSession(context) {
    const { scope, client } = this.getStackTop();
    const { release, environment } = (client && client.getOptions()) || {};

    // Will fetch userAgent if called from browser sdk
    const { userAgent } = utils.GLOBAL_OBJ.navigator || {};

    const session$1 = session.makeSession({
      release,
      environment,
      ...(scope && { user: scope.getUser() }),
      ...(userAgent && { userAgent }),
      ...context,
    });

    if (scope) {
      // End existing session if there's one
      const currentSession = scope.getSession && scope.getSession();
      if (currentSession && currentSession.status === 'ok') {
        session.updateSession(currentSession, { status: 'exited' });
      }
      this.endSession();

      // Afterwards we set the new session on the scope
      scope.setSession(session$1);
    }

    return session$1;
  }

  /**
   * Returns if default PII should be sent to Sentry and propagated in ourgoing requests
   * when Tracing is used.
   */
   shouldSendDefaultPii() {
    const client = this.getClient();
    const options = client && client.getOptions();
    return Boolean(options && options.sendDefaultPii);
  }

  /**
   * Sends the current Session on the scope
   */
   _sendSessionUpdate() {
    const { scope, client } = this.getStackTop();
    if (!scope) return;

    const session = scope.getSession();
    if (session) {
      if (client && client.captureSession) {
        client.captureSession(session);
      }
    }
  }

  /**
   * Internal helper function to call a method on the top client if it exists.
   *
   * @param method The method to call on the client.
   * @param args Arguments to pass to the client function.
   */
   _withClient(callback) {
    const { scope, client } = this.getStackTop();
    if (client) {
      callback(client, scope);
    }
  }

  /**
   * Calls global extension method and binding current instance to the function call
   */
  // @ts-ignore Function lacks ending return statement and return type does not include 'undefined'. ts(2366)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
   _callExtensionMethod(method, ...args) {
    const carrier = getMainCarrier();
    const sentry = carrier.__SENTRY__;
    if (sentry && sentry.extensions && typeof sentry.extensions[method] === 'function') {
      return sentry.extensions[method].apply(this, args);
    }
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn(`Extension method ${method} couldn't be found, doing nothing.`);
  }
}

/**
 * Returns the global shim registry.
 *
 * FIXME: This function is problematic, because despite always returning a valid Carrier,
 * it has an optional `__SENTRY__` property, which then in turn requires us to always perform an unnecessary check
 * at the call-site. We always access the carrier through this function, so we can guarantee that `__SENTRY__` is there.
 **/
function getMainCarrier() {
  utils.GLOBAL_OBJ.__SENTRY__ = utils.GLOBAL_OBJ.__SENTRY__ || {
    extensions: {},
    hub: undefined,
  };
  return utils.GLOBAL_OBJ;
}

/**
 * Replaces the current main hub with the passed one on the global object
 *
 * @returns The old replaced hub
 */
function makeMain(hub) {
  const registry = getMainCarrier();
  const oldHub = getHubFromCarrier(registry);
  setHubOnCarrier(registry, hub);
  return oldHub;
}

/**
 * Returns the default hub instance.
 *
 * If a hub is already registered in the global carrier but this module
 * contains a more recent version, it replaces the registered version.
 * Otherwise, the currently registered hub will be returned.
 */
function getCurrentHub() {
  // Get main carrier (global for every environment)
  const registry = getMainCarrier();

  // If there's no hub, or its an old API, assign a new one
  if (!hasHubOnCarrier(registry) || getHubFromCarrier(registry).isOlderThan(API_VERSION)) {
    setHubOnCarrier(registry, new Hub());
  }

  // Prefer domains over global if they are there (applicable only to Node environment)
  if (utils.isNodeEnv()) {
    return getHubFromActiveDomain(registry);
  }
  // Return hub that lives on a global object
  return getHubFromCarrier(registry);
}

/**
 * Try to read the hub from an active domain, and fallback to the registry if one doesn't exist
 * @returns discovered hub
 */
function getHubFromActiveDomain(registry) {
  try {
    const sentry = getMainCarrier().__SENTRY__;
    const activeDomain = sentry && sentry.extensions && sentry.extensions.domain && sentry.extensions.domain.active;

    // If there's no active domain, just return global hub
    if (!activeDomain) {
      return getHubFromCarrier(registry);
    }

    // If there's no hub on current domain, or it's an old API, assign a new one
    if (!hasHubOnCarrier(activeDomain) || getHubFromCarrier(activeDomain).isOlderThan(API_VERSION)) {
      const registryHubTopStack = getHubFromCarrier(registry).getStackTop();
      setHubOnCarrier(activeDomain, new Hub(registryHubTopStack.client, scope.Scope.clone(registryHubTopStack.scope)));
    }

    // Return hub that lives on a domain
    return getHubFromCarrier(activeDomain);
  } catch (_Oo) {
    // Return hub that lives on a global object
    return getHubFromCarrier(registry);
  }
}

/**
 * This will tell whether a carrier has a hub on it or not
 * @param carrier object
 */
function hasHubOnCarrier(carrier) {
  return !!(carrier && carrier.__SENTRY__ && carrier.__SENTRY__.hub);
}

/**
 * This will create a new {@link Hub} and add to the passed object on
 * __SENTRY__.hub.
 * @param carrier object
 * @hidden
 */
function getHubFromCarrier(carrier) {
  return utils.getGlobalSingleton('hub', () => new Hub(), carrier);
}

/**
 * This will set passed {@link Hub} on the passed object's __SENTRY__.hub attribute
 * @param carrier object
 * @param hub Hub
 * @returns A boolean indicating success or failure
 */
function setHubOnCarrier(carrier, hub) {
  if (!carrier) return false;
  const __SENTRY__ = (carrier.__SENTRY__ = carrier.__SENTRY__ || {});
  __SENTRY__.hub = hub;
  return true;
}

exports.API_VERSION = API_VERSION;
exports.Hub = Hub;
exports.getCurrentHub = getCurrentHub;
exports.getHubFromCarrier = getHubFromCarrier;
exports.getMainCarrier = getMainCarrier;
exports.makeMain = makeMain;
exports.setHubOnCarrier = setHubOnCarrier;
//# sourceMappingURL=hub.js.map


/***/ }),

/***/ 3377:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const exports$1 = __webpack_require__(3240);
const hub = __webpack_require__(6603);
const session = __webpack_require__(6636);
const sessionflusher = __webpack_require__(929);
const scope = __webpack_require__(101);
const api = __webpack_require__(4787);
const baseclient = __webpack_require__(5231);
const sdk = __webpack_require__(2728);
const base = __webpack_require__(4808);
const offline = __webpack_require__(5607);
const version = __webpack_require__(5897);
const integration = __webpack_require__(9756);
const index = __webpack_require__(4373);
const prepareEvent = __webpack_require__(698);
const functiontostring = __webpack_require__(2292);
const inboundfilters = __webpack_require__(3302);



exports.addBreadcrumb = exports$1.addBreadcrumb;
exports.captureEvent = exports$1.captureEvent;
exports.captureException = exports$1.captureException;
exports.captureMessage = exports$1.captureMessage;
exports.configureScope = exports$1.configureScope;
exports.setContext = exports$1.setContext;
exports.setExtra = exports$1.setExtra;
exports.setExtras = exports$1.setExtras;
exports.setTag = exports$1.setTag;
exports.setTags = exports$1.setTags;
exports.setUser = exports$1.setUser;
exports.startTransaction = exports$1.startTransaction;
exports.withScope = exports$1.withScope;
exports.Hub = hub.Hub;
exports.getCurrentHub = hub.getCurrentHub;
exports.getHubFromCarrier = hub.getHubFromCarrier;
exports.getMainCarrier = hub.getMainCarrier;
exports.makeMain = hub.makeMain;
exports.setHubOnCarrier = hub.setHubOnCarrier;
exports.closeSession = session.closeSession;
exports.makeSession = session.makeSession;
exports.updateSession = session.updateSession;
exports.SessionFlusher = sessionflusher.SessionFlusher;
exports.Scope = scope.Scope;
exports.addGlobalEventProcessor = scope.addGlobalEventProcessor;
exports.getEnvelopeEndpointWithUrlEncodedAuth = api.getEnvelopeEndpointWithUrlEncodedAuth;
exports.getReportDialogEndpoint = api.getReportDialogEndpoint;
exports.BaseClient = baseclient.BaseClient;
exports.initAndBind = sdk.initAndBind;
exports.createTransport = base.createTransport;
exports.makeOfflineTransport = offline.makeOfflineTransport;
exports.SDK_VERSION = version.SDK_VERSION;
exports.getIntegrationsToSetup = integration.getIntegrationsToSetup;
exports.Integrations = index;
exports.prepareEvent = prepareEvent.prepareEvent;
exports.FunctionToString = functiontostring.FunctionToString;
exports.InboundFilters = inboundfilters.InboundFilters;
//# sourceMappingURL=index.js.map


/***/ }),

/***/ 9756:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const hub = __webpack_require__(6603);
const scope = __webpack_require__(101);

const installedIntegrations = [];

/** Map of integrations assigned to a client */

/**
 * Remove duplicates from the given array, preferring the last instance of any duplicate. Not guaranteed to
 * preseve the order of integrations in the array.
 *
 * @private
 */
function filterDuplicates(integrations) {
  const integrationsByName = {};

  integrations.forEach(currentInstance => {
    const { name } = currentInstance;

    const existingInstance = integrationsByName[name];

    // We want integrations later in the array to overwrite earlier ones of the same type, except that we never want a
    // default instance to overwrite an existing user instance
    if (existingInstance && !existingInstance.isDefaultInstance && currentInstance.isDefaultInstance) {
      return;
    }

    integrationsByName[name] = currentInstance;
  });

  return Object.values(integrationsByName);
}

/** Gets integrations to install */
function getIntegrationsToSetup(options) {
  const defaultIntegrations = options.defaultIntegrations || [];
  const userIntegrations = options.integrations;

  // We flag default instances, so that later we can tell them apart from any user-created instances of the same class
  defaultIntegrations.forEach(integration => {
    integration.isDefaultInstance = true;
  });

  let integrations;

  if (Array.isArray(userIntegrations)) {
    integrations = [...defaultIntegrations, ...userIntegrations];
  } else if (typeof userIntegrations === 'function') {
    integrations = utils.arrayify(userIntegrations(defaultIntegrations));
  } else {
    integrations = defaultIntegrations;
  }

  const finalIntegrations = filterDuplicates(integrations);

  // The `Debug` integration prints copies of the `event` and `hint` which will be passed to `beforeSend` or
  // `beforeSendTransaction`. It therefore has to run after all other integrations, so that the changes of all event
  // processors will be reflected in the printed values. For lack of a more elegant way to guarantee that, we therefore
  // locate it and, assuming it exists, pop it out of its current spot and shove it onto the end of the array.
  const debugIndex = finalIntegrations.findIndex(integration => integration.name === 'Debug');
  if (debugIndex !== -1) {
    const [debugInstance] = finalIntegrations.splice(debugIndex, 1);
    finalIntegrations.push(debugInstance);
  }

  return finalIntegrations;
}

/**
 * Given a list of integration instances this installs them all. When `withDefaults` is set to `true` then all default
 * integrations are added unless they were already provided before.
 * @param integrations array of integration instances
 * @param withDefault should enable default integrations
 */
function setupIntegrations(integrations) {
  const integrationIndex = {};

  integrations.forEach(integration => {
    setupIntegration(integration, integrationIndex);
  });

  return integrationIndex;
}

/** Setup a single integration.  */
function setupIntegration(integration, integrationIndex) {
  integrationIndex[integration.name] = integration;

  if (installedIntegrations.indexOf(integration.name) === -1) {
    integration.setupOnce(scope.addGlobalEventProcessor, hub.getCurrentHub);
    installedIntegrations.push(integration.name);
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`Integration installed: ${integration.name}`);
  }
}

exports.getIntegrationsToSetup = getIntegrationsToSetup;
exports.installedIntegrations = installedIntegrations;
exports.setupIntegration = setupIntegration;
exports.setupIntegrations = setupIntegrations;
//# sourceMappingURL=integration.js.map


/***/ }),

/***/ 2292:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

let originalFunctionToString;

/** Patch toString calls to return proper name for wrapped functions */
class FunctionToString  {constructor() { FunctionToString.prototype.__init.call(this); }
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'FunctionToString';}

  /**
   * @inheritDoc
   */
   __init() {this.name = FunctionToString.id;}

  /**
   * @inheritDoc
   */
   setupOnce() {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    originalFunctionToString = Function.prototype.toString;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Function.prototype.toString = function ( ...args) {
      const context = utils.getOriginalFunction(this) || this;
      return originalFunctionToString.apply(context, args);
    };
  }
} FunctionToString.__initStatic();

exports.FunctionToString = FunctionToString;
//# sourceMappingURL=functiontostring.js.map


/***/ }),

/***/ 3302:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

// "Script error." is hard coded into browsers for errors that it can't read.
// this is the result of a script being pulled in from an external domain and CORS.
const DEFAULT_IGNORE_ERRORS = [/^Script error\.?$/, /^Javascript error: Script error\.? on line 0$/];

/** Options for the InboundFilters integration */

/** Inbound filters configurable by the user */
class InboundFilters  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'InboundFilters';}

  /**
   * @inheritDoc
   */
   __init() {this.name = InboundFilters.id;}

   constructor(  _options = {}) {this._options = _options;InboundFilters.prototype.__init.call(this);}

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor, getCurrentHub) {
    const eventProcess = (event) => {
      const hub = getCurrentHub();
      if (hub) {
        const self = hub.getIntegration(InboundFilters);
        if (self) {
          const client = hub.getClient();
          const clientOptions = client ? client.getOptions() : {};
          const options = _mergeOptions(self._options, clientOptions);
          return _shouldDropEvent(event, options) ? null : event;
        }
      }
      return event;
    };

    eventProcess.id = this.name;
    addGlobalEventProcessor(eventProcess);
  }
} InboundFilters.__initStatic();

/** JSDoc */
function _mergeOptions(
  internalOptions = {},
  clientOptions = {},
) {
  return {
    allowUrls: [...(internalOptions.allowUrls || []), ...(clientOptions.allowUrls || [])],
    denyUrls: [...(internalOptions.denyUrls || []), ...(clientOptions.denyUrls || [])],
    ignoreErrors: [
      ...(internalOptions.ignoreErrors || []),
      ...(clientOptions.ignoreErrors || []),
      ...DEFAULT_IGNORE_ERRORS,
    ],
    ignoreInternal: internalOptions.ignoreInternal !== undefined ? internalOptions.ignoreInternal : true,
  };
}

/** JSDoc */
function _shouldDropEvent(event, options) {
  if (options.ignoreInternal && _isSentryError(event)) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
      utils.logger.warn(`Event dropped due to being internal Sentry Error.\nEvent: ${utils.getEventDescription(event)}`);
    return true;
  }
  if (_isIgnoredError(event, options.ignoreErrors)) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
      utils.logger.warn(
        `Event dropped due to being matched by \`ignoreErrors\` option.\nEvent: ${utils.getEventDescription(event)}`,
      );
    return true;
  }
  if (_isDeniedUrl(event, options.denyUrls)) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
      utils.logger.warn(
        `Event dropped due to being matched by \`denyUrls\` option.\nEvent: ${utils.getEventDescription(
          event,
        )}.\nUrl: ${_getEventFilterUrl(event)}`,
      );
    return true;
  }
  if (!_isAllowedUrl(event, options.allowUrls)) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
      utils.logger.warn(
        `Event dropped due to not being matched by \`allowUrls\` option.\nEvent: ${utils.getEventDescription(
          event,
        )}.\nUrl: ${_getEventFilterUrl(event)}`,
      );
    return true;
  }
  return false;
}

function _isIgnoredError(event, ignoreErrors) {
  if (!ignoreErrors || !ignoreErrors.length) {
    return false;
  }

  return _getPossibleEventMessages(event).some(message => utils.stringMatchesSomePattern(message, ignoreErrors));
}

function _isDeniedUrl(event, denyUrls) {
  // TODO: Use Glob instead?
  if (!denyUrls || !denyUrls.length) {
    return false;
  }
  const url = _getEventFilterUrl(event);
  return !url ? false : utils.stringMatchesSomePattern(url, denyUrls);
}

function _isAllowedUrl(event, allowUrls) {
  // TODO: Use Glob instead?
  if (!allowUrls || !allowUrls.length) {
    return true;
  }
  const url = _getEventFilterUrl(event);
  return !url ? true : utils.stringMatchesSomePattern(url, allowUrls);
}

function _getPossibleEventMessages(event) {
  if (event.message) {
    return [event.message];
  }
  if (event.exception) {
    try {
      const { type = '', value = '' } = (event.exception.values && event.exception.values[0]) || {};
      return [`${value}`, `${type}: ${value}`];
    } catch (oO) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error(`Cannot extract message for event ${utils.getEventDescription(event)}`);
      return [];
    }
  }
  return [];
}

function _isSentryError(event) {
  try {
    // @ts-ignore can't be a sentry error if undefined
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return event.exception.values[0].type === 'SentryError';
  } catch (e) {
    // ignore
  }
  return false;
}

function _getLastValidUrl(frames = []) {
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i];

    if (frame && frame.filename !== '<anonymous>' && frame.filename !== '[native code]') {
      return frame.filename || null;
    }
  }

  return null;
}

function _getEventFilterUrl(event) {
  try {
    let frames;
    try {
      // @ts-ignore we only care about frames if the whole thing here is defined
      frames = event.exception.values[0].stacktrace.frames;
    } catch (e) {
      // ignore
    }
    return frames ? _getLastValidUrl(frames) : null;
  } catch (oO) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error(`Cannot extract url for event ${utils.getEventDescription(event)}`);
    return null;
  }
}

exports.InboundFilters = InboundFilters;
exports._mergeOptions = _mergeOptions;
exports._shouldDropEvent = _shouldDropEvent;
//# sourceMappingURL=inboundfilters.js.map


/***/ }),

/***/ 4373:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const functiontostring = __webpack_require__(2292);
const inboundfilters = __webpack_require__(3302);



exports.FunctionToString = functiontostring.FunctionToString;
exports.InboundFilters = inboundfilters.InboundFilters;
//# sourceMappingURL=index.js.map


/***/ }),

/***/ 101:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const session = __webpack_require__(6636);

/**
 * Default value for maximum number of breadcrumbs added to an event.
 */
const DEFAULT_MAX_BREADCRUMBS = 100;

/**
 * Holds additional event information. {@link Scope.applyToEvent} will be
 * called by the client before an event will be sent.
 */
class Scope  {
  /** Flag if notifying is happening. */

  /** Callback for client to receive scope changes. */

  /** Callback list that will be called after {@link applyToEvent}. */

  /** Array of breadcrumbs. */

  /** User */

  /** Tags */

  /** Extra */

  /** Contexts */

  /** Attachments */

  /**
   * A place to stash data which is needed at some point in the SDK's event processing pipeline but which shouldn't get
   * sent to Sentry
   */

  /** Fingerprint */

  /** Severity */
  // eslint-disable-next-line deprecation/deprecation

  /** Transaction Name */

  /** Span */

  /** Session */

  /** Request Mode Session Status */

  // NOTE: Any field which gets added here should get added not only to the constructor but also to the `clone` method.

   constructor() {
    this._notifyingListeners = false;
    this._scopeListeners = [];
    this._eventProcessors = [];
    this._breadcrumbs = [];
    this._attachments = [];
    this._user = {};
    this._tags = {};
    this._extra = {};
    this._contexts = {};
    this._sdkProcessingMetadata = {};
  }

  /**
   * Inherit values from the parent scope.
   * @param scope to clone.
   */
   static clone(scope) {
    const newScope = new Scope();
    if (scope) {
      newScope._breadcrumbs = [...scope._breadcrumbs];
      newScope._tags = { ...scope._tags };
      newScope._extra = { ...scope._extra };
      newScope._contexts = { ...scope._contexts };
      newScope._user = scope._user;
      newScope._level = scope._level;
      newScope._span = scope._span;
      newScope._session = scope._session;
      newScope._transactionName = scope._transactionName;
      newScope._fingerprint = scope._fingerprint;
      newScope._eventProcessors = [...scope._eventProcessors];
      newScope._requestSession = scope._requestSession;
      newScope._attachments = [...scope._attachments];
      newScope._sdkProcessingMetadata = { ...scope._sdkProcessingMetadata };
    }
    return newScope;
  }

  /**
   * Add internal on change listener. Used for sub SDKs that need to store the scope.
   * @hidden
   */
   addScopeListener(callback) {
    this._scopeListeners.push(callback);
  }

  /**
   * @inheritDoc
   */
   addEventProcessor(callback) {
    this._eventProcessors.push(callback);
    return this;
  }

  /**
   * @inheritDoc
   */
   setUser(user) {
    this._user = user || {};
    if (this._session) {
      session.updateSession(this._session, { user });
    }
    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   getUser() {
    return this._user;
  }

  /**
   * @inheritDoc
   */
   getRequestSession() {
    return this._requestSession;
  }

  /**
   * @inheritDoc
   */
   setRequestSession(requestSession) {
    this._requestSession = requestSession;
    return this;
  }

  /**
   * @inheritDoc
   */
   setTags(tags) {
    this._tags = {
      ...this._tags,
      ...tags,
    };
    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   setTag(key, value) {
    this._tags = { ...this._tags, [key]: value };
    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   setExtras(extras) {
    this._extra = {
      ...this._extra,
      ...extras,
    };
    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   setExtra(key, extra) {
    this._extra = { ...this._extra, [key]: extra };
    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   setFingerprint(fingerprint) {
    this._fingerprint = fingerprint;
    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   setLevel(
    // eslint-disable-next-line deprecation/deprecation
    level,
  ) {
    this._level = level;
    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   setTransactionName(name) {
    this._transactionName = name;
    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   setContext(key, context) {
    if (context === null) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this._contexts[key];
    } else {
      this._contexts[key] = context;
    }

    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   setSpan(span) {
    this._span = span;
    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   getSpan() {
    return this._span;
  }

  /**
   * @inheritDoc
   */
   getTransaction() {
    // Often, this span (if it exists at all) will be a transaction, but it's not guaranteed to be. Regardless, it will
    // have a pointer to the currently-active transaction.
    const span = this.getSpan();
    return span && span.transaction;
  }

  /**
   * @inheritDoc
   */
   setSession(session) {
    if (!session) {
      delete this._session;
    } else {
      this._session = session;
    }
    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   getSession() {
    return this._session;
  }

  /**
   * @inheritDoc
   */
   update(captureContext) {
    if (!captureContext) {
      return this;
    }

    if (typeof captureContext === 'function') {
      const updatedScope = (captureContext )(this);
      return updatedScope instanceof Scope ? updatedScope : this;
    }

    if (captureContext instanceof Scope) {
      this._tags = { ...this._tags, ...captureContext._tags };
      this._extra = { ...this._extra, ...captureContext._extra };
      this._contexts = { ...this._contexts, ...captureContext._contexts };
      if (captureContext._user && Object.keys(captureContext._user).length) {
        this._user = captureContext._user;
      }
      if (captureContext._level) {
        this._level = captureContext._level;
      }
      if (captureContext._fingerprint) {
        this._fingerprint = captureContext._fingerprint;
      }
      if (captureContext._requestSession) {
        this._requestSession = captureContext._requestSession;
      }
    } else if (utils.isPlainObject(captureContext)) {
      // eslint-disable-next-line no-param-reassign
      captureContext = captureContext ;
      this._tags = { ...this._tags, ...captureContext.tags };
      this._extra = { ...this._extra, ...captureContext.extra };
      this._contexts = { ...this._contexts, ...captureContext.contexts };
      if (captureContext.user) {
        this._user = captureContext.user;
      }
      if (captureContext.level) {
        this._level = captureContext.level;
      }
      if (captureContext.fingerprint) {
        this._fingerprint = captureContext.fingerprint;
      }
      if (captureContext.requestSession) {
        this._requestSession = captureContext.requestSession;
      }
    }

    return this;
  }

  /**
   * @inheritDoc
   */
   clear() {
    this._breadcrumbs = [];
    this._tags = {};
    this._extra = {};
    this._user = {};
    this._contexts = {};
    this._level = undefined;
    this._transactionName = undefined;
    this._fingerprint = undefined;
    this._requestSession = undefined;
    this._span = undefined;
    this._session = undefined;
    this._notifyScopeListeners();
    this._attachments = [];
    return this;
  }

  /**
   * @inheritDoc
   */
   addBreadcrumb(breadcrumb, maxBreadcrumbs) {
    const maxCrumbs = typeof maxBreadcrumbs === 'number' ? maxBreadcrumbs : DEFAULT_MAX_BREADCRUMBS;

    // No data has been changed, so don't notify scope listeners
    if (maxCrumbs <= 0) {
      return this;
    }

    const mergedBreadcrumb = {
      timestamp: utils.dateTimestampInSeconds(),
      ...breadcrumb,
    };
    this._breadcrumbs = [...this._breadcrumbs, mergedBreadcrumb].slice(-maxCrumbs);
    this._notifyScopeListeners();

    return this;
  }

  /**
   * @inheritDoc
   */
   getLastBreadcrumb() {
    return this._breadcrumbs[this._breadcrumbs.length - 1];
  }

  /**
   * @inheritDoc
   */
   clearBreadcrumbs() {
    this._breadcrumbs = [];
    this._notifyScopeListeners();
    return this;
  }

  /**
   * @inheritDoc
   */
   addAttachment(attachment) {
    this._attachments.push(attachment);
    return this;
  }

  /**
   * @inheritDoc
   */
   getAttachments() {
    return this._attachments;
  }

  /**
   * @inheritDoc
   */
   clearAttachments() {
    this._attachments = [];
    return this;
  }

  /**
   * Applies data from the scope to the event and runs all event processors on it.
   *
   * @param event Event
   * @param hint Object containing additional information about the original exception, for use by the event processors.
   * @hidden
   */
   applyToEvent(event, hint = {}) {
    if (this._extra && Object.keys(this._extra).length) {
      event.extra = { ...this._extra, ...event.extra };
    }
    if (this._tags && Object.keys(this._tags).length) {
      event.tags = { ...this._tags, ...event.tags };
    }
    if (this._user && Object.keys(this._user).length) {
      event.user = { ...this._user, ...event.user };
    }
    if (this._contexts && Object.keys(this._contexts).length) {
      event.contexts = { ...this._contexts, ...event.contexts };
    }
    if (this._level) {
      event.level = this._level;
    }
    if (this._transactionName) {
      event.transaction = this._transactionName;
    }

    // We want to set the trace context for normal events only if there isn't already
    // a trace context on the event. There is a product feature in place where we link
    // errors with transaction and it relies on that.
    if (this._span) {
      event.contexts = { trace: this._span.getTraceContext(), ...event.contexts };
      const transactionName = this._span.transaction && this._span.transaction.name;
      if (transactionName) {
        event.tags = { transaction: transactionName, ...event.tags };
      }
    }

    this._applyFingerprint(event);

    event.breadcrumbs = [...(event.breadcrumbs || []), ...this._breadcrumbs];
    event.breadcrumbs = event.breadcrumbs.length > 0 ? event.breadcrumbs : undefined;

    event.sdkProcessingMetadata = { ...event.sdkProcessingMetadata, ...this._sdkProcessingMetadata };

    return this._notifyEventProcessors([...getGlobalEventProcessors(), ...this._eventProcessors], event, hint);
  }

  /**
   * Add data which will be accessible during event processing but won't get sent to Sentry
   */
   setSDKProcessingMetadata(newData) {
    this._sdkProcessingMetadata = { ...this._sdkProcessingMetadata, ...newData };

    return this;
  }

  /**
   * This will be called after {@link applyToEvent} is finished.
   */
   _notifyEventProcessors(
    processors,
    event,
    hint,
    index = 0,
  ) {
    return new utils.SyncPromise((resolve, reject) => {
      const processor = processors[index];
      if (event === null || typeof processor !== 'function') {
        resolve(event);
      } else {
        const result = processor({ ...event }, hint) ;

        (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
          processor.id &&
          result === null &&
          utils.logger.log(`Event processor "${processor.id}" dropped event`);

        if (utils.isThenable(result)) {
          void result
            .then(final => this._notifyEventProcessors(processors, final, hint, index + 1).then(resolve))
            .then(null, reject);
        } else {
          void this._notifyEventProcessors(processors, result, hint, index + 1)
            .then(resolve)
            .then(null, reject);
        }
      }
    });
  }

  /**
   * This will be called on every set call.
   */
   _notifyScopeListeners() {
    // We need this check for this._notifyingListeners to be able to work on scope during updates
    // If this check is not here we'll produce endless recursion when something is done with the scope
    // during the callback.
    if (!this._notifyingListeners) {
      this._notifyingListeners = true;
      this._scopeListeners.forEach(callback => {
        callback(this);
      });
      this._notifyingListeners = false;
    }
  }

  /**
   * Applies fingerprint from the scope to the event if there's one,
   * uses message if there's one instead or get rid of empty fingerprint
   */
   _applyFingerprint(event) {
    // Make sure it's an array first and we actually have something in place
    event.fingerprint = event.fingerprint ? utils.arrayify(event.fingerprint) : [];

    // If we have something on the scope, then merge it with event
    if (this._fingerprint) {
      event.fingerprint = event.fingerprint.concat(this._fingerprint);
    }

    // If we have no data at all, remove empty array default
    if (event.fingerprint && !event.fingerprint.length) {
      delete event.fingerprint;
    }
  }
}

/**
 * Returns the global event processors.
 */
function getGlobalEventProcessors() {
  return utils.getGlobalSingleton('globalEventProcessors', () => []);
}

/**
 * Add a EventProcessor to be kept globally.
 * @param callback EventProcessor to add
 */
function addGlobalEventProcessor(callback) {
  getGlobalEventProcessors().push(callback);
}

exports.Scope = Scope;
exports.addGlobalEventProcessor = addGlobalEventProcessor;
//# sourceMappingURL=scope.js.map


/***/ }),

/***/ 2728:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const hub = __webpack_require__(6603);

/** A class object that can instantiate Client objects. */

/**
 * Internal function to create a new SDK client instance. The client is
 * installed and then bound to the current scope.
 *
 * @param clientClass The client class to instantiate.
 * @param options Options to pass to the client.
 */
function initAndBind(
  clientClass,
  options,
) {
  if (options.debug === true) {
    if ((typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__)) {
      utils.logger.enable();
    } else {
      // use `console.warn` rather than `logger.warn` since by non-debug bundles have all `logger.x` statements stripped
      // eslint-disable-next-line no-console
      console.warn('[Sentry] Cannot initialize SDK with `debug` option using a non-debug bundle.');
    }
  }
  const hub$1 = hub.getCurrentHub();
  const scope = hub$1.getScope();
  if (scope) {
    scope.update(options.initialScope);
  }

  const client = new clientClass(options);
  hub$1.bindClient(client);
}

exports.initAndBind = initAndBind;
//# sourceMappingURL=sdk.js.map


/***/ }),

/***/ 6636:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

/**
 * Creates a new `Session` object by setting certain default parameters. If optional @param context
 * is passed, the passed properties are applied to the session object.
 *
 * @param context (optional) additional properties to be applied to the returned session object
 *
 * @returns a new `Session` object
 */
function makeSession(context) {
  // Both timestamp and started are in seconds since the UNIX epoch.
  const startingTime = utils.timestampInSeconds();

  const session = {
    sid: utils.uuid4(),
    init: true,
    timestamp: startingTime,
    started: startingTime,
    duration: 0,
    status: 'ok',
    errors: 0,
    ignoreDuration: false,
    toJSON: () => sessionToJSON(session),
  };

  if (context) {
    updateSession(session, context);
  }

  return session;
}

/**
 * Updates a session object with the properties passed in the context.
 *
 * Note that this function mutates the passed object and returns void.
 * (Had to do this instead of returning a new and updated session because closing and sending a session
 * makes an update to the session after it was passed to the sending logic.
 * @see BaseClient.captureSession )
 *
 * @param session the `Session` to update
 * @param context the `SessionContext` holding the properties that should be updated in @param session
 */
// eslint-disable-next-line complexity
function updateSession(session, context = {}) {
  if (context.user) {
    if (!session.ipAddress && context.user.ip_address) {
      session.ipAddress = context.user.ip_address;
    }

    if (!session.did && !context.did) {
      session.did = context.user.id || context.user.email || context.user.username;
    }
  }

  session.timestamp = context.timestamp || utils.timestampInSeconds();

  if (context.ignoreDuration) {
    session.ignoreDuration = context.ignoreDuration;
  }
  if (context.sid) {
    // Good enough uuid validation. — Kamil
    session.sid = context.sid.length === 32 ? context.sid : utils.uuid4();
  }
  if (context.init !== undefined) {
    session.init = context.init;
  }
  if (!session.did && context.did) {
    session.did = `${context.did}`;
  }
  if (typeof context.started === 'number') {
    session.started = context.started;
  }
  if (session.ignoreDuration) {
    session.duration = undefined;
  } else if (typeof context.duration === 'number') {
    session.duration = context.duration;
  } else {
    const duration = session.timestamp - session.started;
    session.duration = duration >= 0 ? duration : 0;
  }
  if (context.release) {
    session.release = context.release;
  }
  if (context.environment) {
    session.environment = context.environment;
  }
  if (!session.ipAddress && context.ipAddress) {
    session.ipAddress = context.ipAddress;
  }
  if (!session.userAgent && context.userAgent) {
    session.userAgent = context.userAgent;
  }
  if (typeof context.errors === 'number') {
    session.errors = context.errors;
  }
  if (context.status) {
    session.status = context.status;
  }
}

/**
 * Closes a session by setting its status and updating the session object with it.
 * Internally calls `updateSession` to update the passed session object.
 *
 * Note that this function mutates the passed session (@see updateSession for explanation).
 *
 * @param session the `Session` object to be closed
 * @param status the `SessionStatus` with which the session was closed. If you don't pass a status,
 *               this function will keep the previously set status, unless it was `'ok'` in which case
 *               it is changed to `'exited'`.
 */
function closeSession(session, status) {
  let context = {};
  if (status) {
    context = { status };
  } else if (session.status === 'ok') {
    context = { status: 'exited' };
  }

  updateSession(session, context);
}

/**
 * Serializes a passed session object to a JSON object with a slightly different structure.
 * This is necessary because the Sentry backend requires a slightly different schema of a session
 * than the one the JS SDKs use internally.
 *
 * @param session the session to be converted
 *
 * @returns a JSON object of the passed session
 */
function sessionToJSON(session) {
  return utils.dropUndefinedKeys({
    sid: `${session.sid}`,
    init: session.init,
    // Make sure that sec is converted to ms for date constructor
    started: new Date(session.started * 1000).toISOString(),
    timestamp: new Date(session.timestamp * 1000).toISOString(),
    status: session.status,
    errors: session.errors,
    did: typeof session.did === 'number' || typeof session.did === 'string' ? `${session.did}` : undefined,
    duration: session.duration,
    attrs: {
      release: session.release,
      environment: session.environment,
      ip_address: session.ipAddress,
      user_agent: session.userAgent,
    },
  });
}

exports.closeSession = closeSession;
exports.makeSession = makeSession;
exports.updateSession = updateSession;
//# sourceMappingURL=session.js.map


/***/ }),

/***/ 929:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const hub = __webpack_require__(6603);

/**
 * @inheritdoc
 */
class SessionFlusher  {
    __init() {this.flushTimeout = 60;}
   __init2() {this._pendingAggregates = {};}

   __init3() {this._isEnabled = true;}

   constructor(client, attrs) {SessionFlusher.prototype.__init.call(this);SessionFlusher.prototype.__init2.call(this);SessionFlusher.prototype.__init3.call(this);
    this._client = client;
    // Call to setInterval, so that flush is called every 60 seconds
    this._intervalId = setInterval(() => this.flush(), this.flushTimeout * 1000);
    this._sessionAttrs = attrs;
  }

  /** Checks if `pendingAggregates` has entries, and if it does flushes them by calling `sendSession` */
   flush() {
    const sessionAggregates = this.getSessionAggregates();
    if (sessionAggregates.aggregates.length === 0) {
      return;
    }
    this._pendingAggregates = {};
    this._client.sendSession(sessionAggregates);
  }

  /** Massages the entries in `pendingAggregates` and returns aggregated sessions */
   getSessionAggregates() {
    const aggregates = Object.keys(this._pendingAggregates).map((key) => {
      return this._pendingAggregates[parseInt(key)];
    });

    const sessionAggregates = {
      attrs: this._sessionAttrs,
      aggregates,
    };
    return utils.dropUndefinedKeys(sessionAggregates);
  }

  /** JSDoc */
   close() {
    clearInterval(this._intervalId);
    this._isEnabled = false;
    this.flush();
  }

  /**
   * Wrapper function for _incrementSessionStatusCount that checks if the instance of SessionFlusher is enabled then
   * fetches the session status of the request from `Scope.getRequestSession().status` on the scope and passes them to
   * `_incrementSessionStatusCount` along with the start date
   */
   incrementSessionStatusCount() {
    if (!this._isEnabled) {
      return;
    }
    const scope = hub.getCurrentHub().getScope();
    const requestSession = scope && scope.getRequestSession();

    if (requestSession && requestSession.status) {
      this._incrementSessionStatusCount(requestSession.status, new Date());
      // This is not entirely necessarily but is added as a safe guard to indicate the bounds of a request and so in
      // case captureRequestSession is called more than once to prevent double count
      if (scope) {
        scope.setRequestSession(undefined);
      }
      /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    }
  }

  /**
   * Increments status bucket in pendingAggregates buffer (internal state) corresponding to status of
   * the session received
   */
   _incrementSessionStatusCount(status, date) {
    // Truncate minutes and seconds on Session Started attribute to have one minute bucket keys
    const sessionStartedTrunc = new Date(date).setSeconds(0, 0);
    this._pendingAggregates[sessionStartedTrunc] = this._pendingAggregates[sessionStartedTrunc] || {};

    // corresponds to aggregated sessions in one specific minute bucket
    // for example, {"started":"2021-03-16T08:00:00.000Z","exited":4, "errored": 1}
    const aggregationCounts = this._pendingAggregates[sessionStartedTrunc];
    if (!aggregationCounts.started) {
      aggregationCounts.started = new Date(sessionStartedTrunc).toISOString();
    }

    switch (status) {
      case 'errored':
        aggregationCounts.errored = (aggregationCounts.errored || 0) + 1;
        return aggregationCounts.errored;
      case 'ok':
        aggregationCounts.exited = (aggregationCounts.exited || 0) + 1;
        return aggregationCounts.exited;
      default:
        aggregationCounts.crashed = (aggregationCounts.crashed || 0) + 1;
        return aggregationCounts.crashed;
    }
  }
}

exports.SessionFlusher = SessionFlusher;
//# sourceMappingURL=sessionflusher.js.map


/***/ }),

/***/ 4808:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

const DEFAULT_TRANSPORT_BUFFER_SIZE = 30;

/**
 * Creates an instance of a Sentry `Transport`
 *
 * @param options
 * @param makeRequest
 */
function createTransport(
  options,
  makeRequest,
  buffer = utils.makePromiseBuffer(
    options.bufferSize || DEFAULT_TRANSPORT_BUFFER_SIZE,
  ),
) {
  let rateLimits = {};

  const flush = (timeout) => buffer.drain(timeout);

  function send(envelope) {
    const filteredEnvelopeItems = [];

    // Drop rate limited items from envelope
    utils.forEachEnvelopeItem(envelope, (item, type) => {
      const envelopeItemDataCategory = utils.envelopeItemTypeToDataCategory(type);
      if (utils.isRateLimited(rateLimits, envelopeItemDataCategory)) {
        const event = getEventForEnvelopeItem(item, type);
        options.recordDroppedEvent('ratelimit_backoff', envelopeItemDataCategory, event);
      } else {
        filteredEnvelopeItems.push(item);
      }
    });

    // Skip sending if envelope is empty after filtering out rate limited events
    if (filteredEnvelopeItems.length === 0) {
      return utils.resolvedSyncPromise();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filteredEnvelope = utils.createEnvelope(envelope[0], filteredEnvelopeItems );

    // Creates client report for each item in an envelope
    const recordEnvelopeLoss = (reason) => {
      utils.forEachEnvelopeItem(filteredEnvelope, (item, type) => {
        const event = getEventForEnvelopeItem(item, type);
        options.recordDroppedEvent(reason, utils.envelopeItemTypeToDataCategory(type), event);
      });
    };

    const requestTask = () =>
      makeRequest({ body: utils.serializeEnvelope(filteredEnvelope, options.textEncoder) }).then(
        response => {
          // We don't want to throw on NOK responses, but we want to at least log them
          if (response.statusCode !== undefined && (response.statusCode < 200 || response.statusCode >= 300)) {
            (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn(`Sentry responded with status code ${response.statusCode} to sent event.`);
          }

          rateLimits = utils.updateRateLimits(rateLimits, response);
          return response;
        },
        error => {
          recordEnvelopeLoss('network_error');
          throw error;
        },
      );

    return buffer.add(requestTask).then(
      result => result,
      error => {
        if (error instanceof utils.SentryError) {
          (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error('Skipped sending event because buffer is full.');
          recordEnvelopeLoss('queue_overflow');
          return utils.resolvedSyncPromise();
        } else {
          throw error;
        }
      },
    );
  }

  return {
    send,
    flush,
  };
}

function getEventForEnvelopeItem(item, type) {
  if (type !== 'event' && type !== 'transaction') {
    return undefined;
  }

  return Array.isArray(item) ? (item )[1] : undefined;
}

exports.DEFAULT_TRANSPORT_BUFFER_SIZE = DEFAULT_TRANSPORT_BUFFER_SIZE;
exports.createTransport = createTransport;
//# sourceMappingURL=base.js.map


/***/ }),

/***/ 5607:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

const MIN_DELAY = 100; // 100 ms
const START_DELAY = 5000; // 5 seconds
const MAX_DELAY = 3.6e6; // 1 hour

function isReplayEnvelope(envelope) {
  let isReplay = false;

  utils.forEachEnvelopeItem(envelope, (_, type) => {
    if (type === 'replay_event') {
      isReplay = true;
    }
  });

  return isReplay;
}

function log(msg, error) {
  (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.info(`[Offline]: ${msg}`, error);
}

/**
 * Wraps a transport and stores and retries events when they fail to send.
 *
 * @param createTransport The transport to wrap.
 */
function makeOfflineTransport(
  createTransport,
) {
  return options => {
    const transport = createTransport(options);
    const store = options.createStore ? options.createStore(options) : undefined;

    let retryDelay = START_DELAY;
    let flushTimer;

    function shouldQueue(env, error, retryDelay) {
      // We don't queue Session Replay envelopes because they are:
      // - Ordered and Replay relies on the response status to know when they're successfully sent.
      // - Likely to fill the queue quickly and block other events from being sent.
      if (isReplayEnvelope(env)) {
        return false;
      }

      if (options.shouldStore) {
        return options.shouldStore(env, error, retryDelay);
      }

      return true;
    }

    function flushIn(delay) {
      if (!store) {
        return;
      }

      if (flushTimer) {
        clearTimeout(flushTimer );
      }

      flushTimer = setTimeout(async () => {
        flushTimer = undefined;

        const found = await store.pop();
        if (found) {
          log('Attempting to send previously queued event');
          void send(found).catch(e => {
            log('Failed to retry sending', e);
          });
        }
      }, delay) ;

      // We need to unref the timer in node.js, otherwise the node process never exit.
      if (typeof flushTimer !== 'number' && flushTimer.unref) {
        flushTimer.unref();
      }
    }

    function flushWithBackOff() {
      if (flushTimer) {
        return;
      }

      flushIn(retryDelay);

      retryDelay = Math.min(retryDelay * 2, MAX_DELAY);
    }

    async function send(envelope) {
      try {
        const result = await transport.send(envelope);

        let delay = MIN_DELAY;

        if (result) {
          // If there's a retry-after header, use that as the next delay.
          if (result.headers && result.headers['retry-after']) {
            delay = utils.parseRetryAfterHeader(result.headers['retry-after']);
          } // If we have a server error, return now so we don't flush the queue.
          else if ((result.statusCode || 0) >= 400) {
            return result;
          }
        }

        flushIn(delay);
        retryDelay = START_DELAY;
        return result;
      } catch (e) {
        if (store && (await shouldQueue(envelope, e, retryDelay))) {
          await store.insert(envelope);
          flushWithBackOff();
          log('Error sending. Event queued', e);
          return {};
        } else {
          throw e;
        }
      }
    }

    if (options.flushAtStartup) {
      flushWithBackOff();
    }

    return {
      send,
      flush: t => transport.flush(t),
    };
  };
}

exports.MIN_DELAY = MIN_DELAY;
exports.START_DELAY = START_DELAY;
exports.makeOfflineTransport = makeOfflineTransport;
//# sourceMappingURL=offline.js.map


/***/ }),

/***/ 698:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const scope = __webpack_require__(101);

/**
 * Adds common information to events.
 *
 * The information includes release and environment from `options`,
 * breadcrumbs and context (extra, tags and user) from the scope.
 *
 * Information that is already present in the event is never overwritten. For
 * nested objects, such as the context, keys are merged.
 *
 * Note: This also triggers callbacks for `addGlobalEventProcessor`, but not `beforeSend`.
 *
 * @param event The original event.
 * @param hint May contain additional information about the original exception.
 * @param scope A scope containing event metadata.
 * @returns A new event with more information.
 * @hidden
 */
function prepareEvent(
  options,
  event,
  hint,
  scope$1,
) {
  const { normalizeDepth = 3, normalizeMaxBreadth = 1000 } = options;
  const prepared = {
    ...event,
    event_id: event.event_id || hint.event_id || utils.uuid4(),
    timestamp: event.timestamp || utils.dateTimestampInSeconds(),
  };
  const integrations = hint.integrations || options.integrations.map(i => i.name);

  applyClientOptions(prepared, options);
  applyIntegrationsMetadata(prepared, integrations);

  // If we have scope given to us, use it as the base for further modifications.
  // This allows us to prevent unnecessary copying of data if `captureContext` is not provided.
  let finalScope = scope$1;
  if (hint.captureContext) {
    finalScope = scope.Scope.clone(finalScope).update(hint.captureContext);
  }

  // We prepare the result here with a resolved Event.
  let result = utils.resolvedSyncPromise(prepared);

  // This should be the last thing called, since we want that
  // {@link Hub.addEventProcessor} gets the finished prepared event.
  //
  // We need to check for the existence of `finalScope.getAttachments`
  // because `getAttachments` can be undefined if users are using an older version
  // of `@sentry/core` that does not have the `getAttachments` method.
  // See: https://github.com/getsentry/sentry-javascript/issues/5229
  if (finalScope) {
    // Collect attachments from the hint and scope
    if (finalScope.getAttachments) {
      const attachments = [...(hint.attachments || []), ...finalScope.getAttachments()];

      if (attachments.length) {
        hint.attachments = attachments;
      }
    }

    // In case we have a hub we reassign it.
    result = finalScope.applyToEvent(prepared, hint);
  }

  return result.then(evt => {
    if (typeof normalizeDepth === 'number' && normalizeDepth > 0) {
      return normalizeEvent(evt, normalizeDepth, normalizeMaxBreadth);
    }
    return evt;
  });
}

/**
 *  Enhances event using the client configuration.
 *  It takes care of all "static" values like environment, release and `dist`,
 *  as well as truncating overly long values.
 * @param event event instance to be enhanced
 */
function applyClientOptions(event, options) {
  const { environment, release, dist, maxValueLength = 250 } = options;

  if (!('environment' in event)) {
    event.environment = 'environment' in options ? environment : 'production';
  }

  if (event.release === undefined && release !== undefined) {
    event.release = release;
  }

  if (event.dist === undefined && dist !== undefined) {
    event.dist = dist;
  }

  if (event.message) {
    event.message = utils.truncate(event.message, maxValueLength);
  }

  const exception = event.exception && event.exception.values && event.exception.values[0];
  if (exception && exception.value) {
    exception.value = utils.truncate(exception.value, maxValueLength);
  }

  const request = event.request;
  if (request && request.url) {
    request.url = utils.truncate(request.url, maxValueLength);
  }
}

/**
 * This function adds all used integrations to the SDK info in the event.
 * @param event The event that will be filled with all integrations.
 */
function applyIntegrationsMetadata(event, integrationNames) {
  if (integrationNames.length > 0) {
    event.sdk = event.sdk || {};
    event.sdk.integrations = [...(event.sdk.integrations || []), ...integrationNames];
  }
}

/**
 * Applies `normalize` function on necessary `Event` attributes to make them safe for serialization.
 * Normalized keys:
 * - `breadcrumbs.data`
 * - `user`
 * - `contexts`
 * - `extra`
 * @param event Event
 * @returns Normalized event
 */
function normalizeEvent(event, depth, maxBreadth) {
  if (!event) {
    return null;
  }

  const normalized = {
    ...event,
    ...(event.breadcrumbs && {
      breadcrumbs: event.breadcrumbs.map(b => ({
        ...b,
        ...(b.data && {
          data: utils.normalize(b.data, depth, maxBreadth),
        }),
      })),
    }),
    ...(event.user && {
      user: utils.normalize(event.user, depth, maxBreadth),
    }),
    ...(event.contexts && {
      contexts: utils.normalize(event.contexts, depth, maxBreadth),
    }),
    ...(event.extra && {
      extra: utils.normalize(event.extra, depth, maxBreadth),
    }),
  };

  // event.contexts.trace stores information about a Transaction. Similarly,
  // event.spans[] stores information about child Spans. Given that a
  // Transaction is conceptually a Span, normalization should apply to both
  // Transactions and Spans consistently.
  // For now the decision is to skip normalization of Transactions and Spans,
  // so this block overwrites the normalized event to add back the original
  // Transaction information prior to normalization.
  if (event.contexts && event.contexts.trace && normalized.contexts) {
    normalized.contexts.trace = event.contexts.trace;

    // event.contexts.trace.data may contain circular/dangerous data so we need to normalize it
    if (event.contexts.trace.data) {
      normalized.contexts.trace.data = utils.normalize(event.contexts.trace.data, depth, maxBreadth);
    }
  }

  // event.spans[].data may contain circular/dangerous data so we need to normalize it
  if (event.spans) {
    normalized.spans = event.spans.map(span => {
      // We cannot use the spread operator here because `toJSON` on `span` is non-enumerable
      if (span.data) {
        span.data = utils.normalize(span.data, depth, maxBreadth);
      }
      return span;
    });
  }

  return normalized;
}

exports.prepareEvent = prepareEvent;
//# sourceMappingURL=prepareEvent.js.map


/***/ }),

/***/ 5897:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const SDK_VERSION = '7.37.0';

exports.SDK_VERSION = SDK_VERSION;
//# sourceMappingURL=version.js.map


/***/ }),

/***/ 6977:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

/** Send Console API calls as Sentry Events */
class CaptureConsole  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'CaptureConsole';}

  /**
   * @inheritDoc
   */
   __init() {this.name = CaptureConsole.id;}

  /**
   * @inheritDoc
   */
    __init2() {this._levels = utils.CONSOLE_LEVELS;}

  /**
   * @inheritDoc
   */
   constructor(options = {}) {CaptureConsole.prototype.__init.call(this);CaptureConsole.prototype.__init2.call(this);
    if (options.levels) {
      this._levels = options.levels;
    }
  }

  /**
   * @inheritDoc
   */
   setupOnce(_, getCurrentHub) {
    if (!('console' in utils.GLOBAL_OBJ)) {
      return;
    }

    this._levels.forEach((level) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      if (!(level in (utils.GLOBAL_OBJ ).console)) {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      utils.fill((utils.GLOBAL_OBJ ).console, level, (originalConsoleMethod) => (...args) => {
        const hub = getCurrentHub();

        if (hub.getIntegration(CaptureConsole)) {
          hub.withScope(scope => {
            scope.setLevel(utils.severityLevelFromString(level));
            scope.setExtra('arguments', args);
            scope.addEventProcessor(event => {
              event.logger = 'console';
              return event;
            });

            let message = utils.safeJoin(args, ' ');
            if (level === 'assert') {
              if (args[0] === false) {
                message = `Assertion failed: ${utils.safeJoin(args.slice(1), ' ') || 'console.assert'}`;
                scope.setExtra('arguments', args.slice(1));
                hub.captureMessage(message);
              }
            } else if (level === 'error' && args[0] instanceof Error) {
              hub.captureException(args[0]);
            } else {
              hub.captureMessage(message);
            }
          });
        }

        // this fails for some browsers. :(
        if (originalConsoleMethod) {
          originalConsoleMethod.apply(utils.GLOBAL_OBJ.console, args);
        }
      });
    });
  }
} CaptureConsole.__initStatic();

exports.CaptureConsole = CaptureConsole;
//# sourceMappingURL=captureconsole.js.map


/***/ }),

/***/ 9432:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

/**
 * Integration to debug sent Sentry events.
 * This integration should not be used in production
 */
class Debug  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Debug';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Debug.id;}

   constructor(options) {Debug.prototype.__init.call(this);
    this._options = {
      debugger: false,
      stringify: false,
      ...options,
    };
  }

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor, getCurrentHub) {
    addGlobalEventProcessor((event, hint) => {
      const self = getCurrentHub().getIntegration(Debug);
      if (self) {
        if (self._options.debugger) {
          // eslint-disable-next-line no-debugger
          debugger;
        }

        /* eslint-disable no-console */
        utils.consoleSandbox(() => {
          if (self._options.stringify) {
            console.log(JSON.stringify(event, null, 2));
            if (Object.keys(hint).length) {
              console.log(JSON.stringify(hint, null, 2));
            }
          } else {
            console.log(event);
            if (Object.keys(hint).length) {
              console.log(hint);
            }
          }
        });
        /* eslint-enable no-console */
      }
      return event;
    });
  }
} Debug.__initStatic();

exports.Debug = Debug;
//# sourceMappingURL=debug.js.map


/***/ }),

/***/ 9377:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

/** Deduplication filter */
class Dedupe  {constructor() { Dedupe.prototype.__init.call(this); }
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Dedupe';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Dedupe.id;}

  /**
   * @inheritDoc
   */

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor, getCurrentHub) {
    const eventProcessor = currentEvent => {
      const self = getCurrentHub().getIntegration(Dedupe);
      if (self) {
        // Juuust in case something goes wrong
        try {
          if (_shouldDropEvent(currentEvent, self._previousEvent)) {
            (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('Event dropped due to being a duplicate of previously captured event.');
            return null;
          }
        } catch (_oO) {
          return (self._previousEvent = currentEvent);
        }

        return (self._previousEvent = currentEvent);
      }
      return currentEvent;
    };

    eventProcessor.id = this.name;
    addGlobalEventProcessor(eventProcessor);
  }
} Dedupe.__initStatic();

/** JSDoc */
function _shouldDropEvent(currentEvent, previousEvent) {
  if (!previousEvent) {
    return false;
  }

  if (_isSameMessageEvent(currentEvent, previousEvent)) {
    return true;
  }

  if (_isSameExceptionEvent(currentEvent, previousEvent)) {
    return true;
  }

  return false;
}

/** JSDoc */
function _isSameMessageEvent(currentEvent, previousEvent) {
  const currentMessage = currentEvent.message;
  const previousMessage = previousEvent.message;

  // If neither event has a message property, they were both exceptions, so bail out
  if (!currentMessage && !previousMessage) {
    return false;
  }

  // If only one event has a stacktrace, but not the other one, they are not the same
  if ((currentMessage && !previousMessage) || (!currentMessage && previousMessage)) {
    return false;
  }

  if (currentMessage !== previousMessage) {
    return false;
  }

  if (!_isSameFingerprint(currentEvent, previousEvent)) {
    return false;
  }

  if (!_isSameStacktrace(currentEvent, previousEvent)) {
    return false;
  }

  return true;
}

/** JSDoc */
function _isSameExceptionEvent(currentEvent, previousEvent) {
  const previousException = _getExceptionFromEvent(previousEvent);
  const currentException = _getExceptionFromEvent(currentEvent);

  if (!previousException || !currentException) {
    return false;
  }

  if (previousException.type !== currentException.type || previousException.value !== currentException.value) {
    return false;
  }

  if (!_isSameFingerprint(currentEvent, previousEvent)) {
    return false;
  }

  if (!_isSameStacktrace(currentEvent, previousEvent)) {
    return false;
  }

  return true;
}

/** JSDoc */
function _isSameStacktrace(currentEvent, previousEvent) {
  let currentFrames = _getFramesFromEvent(currentEvent);
  let previousFrames = _getFramesFromEvent(previousEvent);

  // If neither event has a stacktrace, they are assumed to be the same
  if (!currentFrames && !previousFrames) {
    return true;
  }

  // If only one event has a stacktrace, but not the other one, they are not the same
  if ((currentFrames && !previousFrames) || (!currentFrames && previousFrames)) {
    return false;
  }

  currentFrames = currentFrames ;
  previousFrames = previousFrames ;

  // If number of frames differ, they are not the same
  if (previousFrames.length !== currentFrames.length) {
    return false;
  }

  // Otherwise, compare the two
  for (let i = 0; i < previousFrames.length; i++) {
    const frameA = previousFrames[i];
    const frameB = currentFrames[i];

    if (
      frameA.filename !== frameB.filename ||
      frameA.lineno !== frameB.lineno ||
      frameA.colno !== frameB.colno ||
      frameA.function !== frameB.function
    ) {
      return false;
    }
  }

  return true;
}

/** JSDoc */
function _isSameFingerprint(currentEvent, previousEvent) {
  let currentFingerprint = currentEvent.fingerprint;
  let previousFingerprint = previousEvent.fingerprint;

  // If neither event has a fingerprint, they are assumed to be the same
  if (!currentFingerprint && !previousFingerprint) {
    return true;
  }

  // If only one event has a fingerprint, but not the other one, they are not the same
  if ((currentFingerprint && !previousFingerprint) || (!currentFingerprint && previousFingerprint)) {
    return false;
  }

  currentFingerprint = currentFingerprint ;
  previousFingerprint = previousFingerprint ;

  // Otherwise, compare the two
  try {
    return !!(currentFingerprint.join('') === previousFingerprint.join(''));
  } catch (_oO) {
    return false;
  }
}

/** JSDoc */
function _getExceptionFromEvent(event) {
  return event.exception && event.exception.values && event.exception.values[0];
}

/** JSDoc */
function _getFramesFromEvent(event) {
  const exception = event.exception;

  if (exception) {
    try {
      // @ts-ignore Object could be undefined
      return exception.values[0].stacktrace.frames;
    } catch (_oO) {
      return undefined;
    }
  }
  return undefined;
}

exports.Dedupe = Dedupe;
exports._shouldDropEvent = _shouldDropEvent;
//# sourceMappingURL=dedupe.js.map


/***/ }),

/***/ 2696:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

/** JSDoc */

/** Patch toString calls to return proper name for wrapped functions */
class ExtraErrorData  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'ExtraErrorData';}

  /**
   * @inheritDoc
   */
   __init() {this.name = ExtraErrorData.id;}

  /** JSDoc */

  /**
   * @inheritDoc
   */
   constructor(options) {ExtraErrorData.prototype.__init.call(this);
    this._options = {
      depth: 3,
      ...options,
    };
  }

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor, getCurrentHub) {
    addGlobalEventProcessor((event, hint) => {
      const self = getCurrentHub().getIntegration(ExtraErrorData);
      if (!self) {
        return event;
      }
      return self.enhanceEventWithErrorData(event, hint);
    });
  }

  /**
   * Attaches extracted information from the Error object to extra field in the Event
   */
   enhanceEventWithErrorData(event, hint = {}) {
    if (!hint.originalException || !utils.isError(hint.originalException)) {
      return event;
    }
    const exceptionName = (hint.originalException ).name || hint.originalException.constructor.name;

    const errorData = this._extractErrorData(hint.originalException );

    if (errorData) {
      const contexts = {
        ...event.contexts,
      };

      const normalizedErrorData = utils.normalize(errorData, this._options.depth);

      if (utils.isPlainObject(normalizedErrorData)) {
        // We mark the error data as "already normalized" here, because we don't want other normalization procedures to
        // potentially truncate the data we just already normalized, with a certain depth setting.
        utils.addNonEnumerableProperty(normalizedErrorData, '__sentry_skip_normalization__', true);
        contexts[exceptionName] = normalizedErrorData;
      }

      return {
        ...event,
        contexts,
      };
    }

    return event;
  }

  /**
   * Extract extra information from the Error object
   */
   _extractErrorData(error) {
    // We are trying to enhance already existing event, so no harm done if it won't succeed
    try {
      const nativeKeys = [
        'name',
        'message',
        'stack',
        'line',
        'column',
        'fileName',
        'lineNumber',
        'columnNumber',
        'toJSON',
      ];

      const extraErrorInfo = {};

      // We want only enumerable properties, thus `getOwnPropertyNames` is redundant here, as we filter keys anyway.
      for (const key of Object.keys(error)) {
        if (nativeKeys.indexOf(key) !== -1) {
          continue;
        }
        const value = error[key];
        extraErrorInfo[key] = utils.isError(value) ? value.toString() : value;
      }

      // Check if someone attached `toJSON` method to grab even more properties (eg. axios is doing that)
      if (typeof error.toJSON === 'function') {
        const serializedError = error.toJSON() ;

        for (const key of Object.keys(serializedError)) {
          const value = serializedError[key];
          extraErrorInfo[key] = utils.isError(value) ? value.toString() : value;
        }
      }

      return extraErrorInfo;
    } catch (oO) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error('Unable to extract extra data from the Error object:', oO);
    }

    return null;
  }
} ExtraErrorData.__initStatic();

exports.ExtraErrorData = ExtraErrorData;
//# sourceMappingURL=extraerrordata.js.map


/***/ }),

/***/ 4185:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

/** HTTPClient integration creates events for failed client side HTTP requests. */
class HttpClient  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'HttpClient';}

  /**
   * @inheritDoc
   */
   __init() {this.name = HttpClient.id;}

  /**
   * Returns current hub.
   */

  /**
   * @inheritDoc
   *
   * @param options
   */
   constructor(options) {HttpClient.prototype.__init.call(this);
    this._options = {
      failedRequestStatusCodes: [[500, 599]],
      failedRequestTargets: [/.*/],
      ...options,
    };
  }

  /**
   * @inheritDoc
   *
   * @param options
   */
   setupOnce(_, getCurrentHub) {
    this._getCurrentHub = getCurrentHub;
    this._wrapFetch();
    this._wrapXHR();
  }

  /**
   * Interceptor function for fetch requests
   *
   * @param requestInfo The Fetch API request info
   * @param response The Fetch API response
   * @param requestInit The request init object
   */
   _fetchResponseHandler(requestInfo, response, requestInit) {
    if (this._getCurrentHub && this._shouldCaptureResponse(response.status, response.url)) {
      const request = new Request(requestInfo, requestInit);
      const hub = this._getCurrentHub();

      let requestHeaders, responseHeaders, requestCookies, responseCookies;

      if (hub.shouldSendDefaultPii()) {
        [{ headers: requestHeaders, cookies: requestCookies }, { headers: responseHeaders, cookies: responseCookies }] =
          [
            { cookieHeader: 'Cookie', obj: request },
            { cookieHeader: 'Set-Cookie', obj: response },
          ].map(({ cookieHeader, obj }) => {
            const headers = this._extractFetchHeaders(obj.headers);
            let cookies;

            try {
              const cookieString = headers[cookieHeader] || headers[cookieHeader.toLowerCase()] || undefined;

              if (cookieString) {
                cookies = this._parseCookieString(cookieString);
              }
            } catch (e) {
              (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`Could not extract cookies from header ${cookieHeader}`);
            }

            return {
              headers,
              cookies,
            };
          });
      }

      const event = this._createEvent({
        url: request.url,
        method: request.method,
        status: response.status,
        requestHeaders,
        responseHeaders,
        requestCookies,
        responseCookies,
      });

      hub.captureEvent(event);
    }
  }

  /**
   * Interceptor function for XHR requests
   *
   * @param xhr The XHR request
   * @param method The HTTP method
   * @param headers The HTTP headers
   */
   _xhrResponseHandler(xhr, method, headers) {
    if (this._getCurrentHub && this._shouldCaptureResponse(xhr.status, xhr.responseURL)) {
      let requestHeaders, responseCookies, responseHeaders;
      const hub = this._getCurrentHub();

      if (hub.shouldSendDefaultPii()) {
        try {
          const cookieString = xhr.getResponseHeader('Set-Cookie') || xhr.getResponseHeader('set-cookie') || undefined;

          if (cookieString) {
            responseCookies = this._parseCookieString(cookieString);
          }
        } catch (e) {
          (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Could not extract cookies from response headers');
        }

        try {
          responseHeaders = this._getXHRResponseHeaders(xhr);
        } catch (e) {
          (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Could not extract headers from response');
        }

        requestHeaders = headers;
      }

      const event = this._createEvent({
        url: xhr.responseURL,
        method: method,
        status: xhr.status,
        requestHeaders,
        // Can't access request cookies from XHR
        responseHeaders,
        responseCookies,
      });

      hub.captureEvent(event);
    }
  }

  /**
   * Extracts response size from `Content-Length` header when possible
   *
   * @param headers
   * @returns The response size in bytes or undefined
   */
   _getResponseSizeFromHeaders(headers) {
    if (headers) {
      const contentLength = headers['Content-Length'] || headers['content-length'];

      if (contentLength) {
        return parseInt(contentLength, 10);
      }
    }

    return undefined;
  }

  /**
   * Creates an object containing cookies from the given cookie string
   *
   * @param cookieString The cookie string to parse
   * @returns The parsed cookies
   */
   _parseCookieString(cookieString) {
    return cookieString.split('; ').reduce((acc, cookie) => {
      const [key, value] = cookie.split('=');
      acc[key] = value;
      return acc;
    }, {});
  }

  /**
   * Extracts the headers as an object from the given Fetch API request or response object
   *
   * @param headers The headers to extract
   * @returns The extracted headers as an object
   */
   _extractFetchHeaders(headers) {
    const result = {};

    headers.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  /**
   * Extracts the response headers as an object from the given XHR object
   *
   * @param xhr The XHR object to extract the response headers from
   * @returns The response headers as an object
   */
   _getXHRResponseHeaders(xhr) {
    const headers = xhr.getAllResponseHeaders();

    if (!headers) {
      return {};
    }

    return headers.split('\r\n').reduce((acc, line) => {
      const [key, value] = line.split(': ');
      acc[key] = value;
      return acc;
    }, {});
  }

  /**
   * Checks if the given target url is in the given list of targets
   *
   * @param target The target url to check
   * @returns true if the target url is in the given list of targets, false otherwise
   */
   _isInGivenRequestTargets(target) {
    if (!this._options.failedRequestTargets) {
      return false;
    }

    return this._options.failedRequestTargets.some((givenRequestTarget) => {
      if (typeof givenRequestTarget === 'string') {
        return target.includes(givenRequestTarget);
      }

      return givenRequestTarget.test(target);
    });
  }

  /**
   * Checks if the given status code is in the given range
   *
   * @param status The status code to check
   * @returns true if the status code is in the given range, false otherwise
   */
   _isInGivenStatusRanges(status) {
    if (!this._options.failedRequestStatusCodes) {
      return false;
    }

    return this._options.failedRequestStatusCodes.some((range) => {
      if (typeof range === 'number') {
        return range === status;
      }

      return status >= range[0] && status <= range[1];
    });
  }

  /**
   * Wraps `fetch` function to capture request and response data
   */
   _wrapFetch() {
    if (!utils.supportsNativeFetch()) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    utils.fill(utils.GLOBAL_OBJ, 'fetch', function (originalFetch) {
      return function ( ...args) {
        const [requestInfo, requestInit] = args ;
        const responsePromise = originalFetch.apply(this, args);

        responsePromise
          .then((response) => {
            self._fetchResponseHandler(requestInfo, response, requestInit);
            return response;
          })
          .catch((error) => {
            throw error;
          });

        return responsePromise;
      };
    });
  }

  /**
   * Wraps XMLHttpRequest to capture request and response data
   */
   _wrapXHR() {
    if (!('XMLHttpRequest' in utils.GLOBAL_OBJ)) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    utils.fill(XMLHttpRequest.prototype, 'open', function (originalOpen) {
      return function ( ...openArgs) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const xhr = this;
        const method = openArgs[0] ;
        const headers = {};

        // Intercepting `setRequestHeader` to access the request headers of XHR instance.
        // This will only work for user/library defined headers, not for the default/browser-assigned headers.
        // Request cookies are also unavailable for XHR, as `Cookie` header can't be defined by `setRequestHeader`.
        utils.fill(
          xhr,
          'setRequestHeader',
          // eslint-disable-next-line @typescript-eslint/ban-types
          function (originalSetRequestHeader) {
            return function (...setRequestHeaderArgs) {
              const [header, value] = setRequestHeaderArgs ;

              headers[header] = value;

              return originalSetRequestHeader.apply(xhr, setRequestHeaderArgs);
            };
          },
        );

        // eslint-disable-next-line @typescript-eslint/ban-types
        utils.fill(xhr, 'onloadend', function (original) {
          return function (...onloadendArgs) {
            try {
              self._xhrResponseHandler(xhr, method, headers);
            } catch (e) {
              (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('Error while extracting response event form XHR response', e);
            }

            if (original) {
              return original.apply(xhr, onloadendArgs);
            }
          };
        });

        return originalOpen.apply(this, openArgs);
      };
    });
  }

  /**
   * Checks whether given url points to Sentry server
   *
   * @param url url to verify
   */
   _isSentryRequest(url) {
    const client = this._getCurrentHub && this._getCurrentHub().getClient();

    if (!client) {
      return false;
    }

    const dsn = client.getDsn();
    return dsn ? url.includes(dsn.host) : false;
  }

  /**
   * Checks whether to capture given response as an event
   *
   * @param status response status code
   * @param url response url
   */
   _shouldCaptureResponse(status, url) {
    return this._isInGivenStatusRanges(status) && this._isInGivenRequestTargets(url) && !this._isSentryRequest(url);
  }

  /**
   * Creates a synthetic Sentry event from given response data
   *
   * @param data response data
   * @returns event
   */
   _createEvent(data

) {
    const message = `HTTP Client Error with status code: ${data.status}`;

    const event = {
      message,
      exception: {
        values: [
          {
            type: 'Error',
            value: message,
          },
        ],
      },
      request: {
        url: data.url,
        method: data.method,
        headers: data.requestHeaders,
        cookies: data.requestCookies,
      },
      contexts: {
        response: {
          status_code: data.status,
          headers: data.responseHeaders,
          cookies: data.responseCookies,
          body_size: this._getResponseSizeFromHeaders(data.responseHeaders),
        },
      },
    };

    utils.addExceptionMechanism(event, {
      type: 'http.client',
    });

    return event;
  }
} HttpClient.__initStatic();

exports.HttpClient = HttpClient;
//# sourceMappingURL=httpclient.js.map


/***/ }),

/***/ 1680:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const captureconsole = __webpack_require__(6977);
const debug = __webpack_require__(9432);
const dedupe = __webpack_require__(9377);
const extraerrordata = __webpack_require__(2696);
const offline = __webpack_require__(7536);
const reportingobserver = __webpack_require__(2285);
const rewriteframes = __webpack_require__(5738);
const sessiontiming = __webpack_require__(8304);
const transaction = __webpack_require__(7987);
const httpclient = __webpack_require__(4185);



exports.CaptureConsole = captureconsole.CaptureConsole;
exports.Debug = debug.Debug;
exports.Dedupe = dedupe.Dedupe;
exports.ExtraErrorData = extraerrordata.ExtraErrorData;
exports.Offline = offline.Offline;
exports.ReportingObserver = reportingobserver.ReportingObserver;
exports.RewriteFrames = rewriteframes.RewriteFrames;
exports.SessionTiming = sessiontiming.SessionTiming;
exports.Transaction = transaction.Transaction;
exports.HttpClient = httpclient.HttpClient;
//# sourceMappingURL=index.js.map


/***/ }),

/***/ 7536:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const localForage = __webpack_require__(6809);

const WINDOW = utils.GLOBAL_OBJ ;

/**
 * cache offline errors and send when connected
 */
class Offline  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Offline';}

  /**
   * @inheritDoc
   */
    __init() {this.name = Offline.id;}

  /**
   * the current hub instance
   */

  /**
   * maximum number of events to store while offline
   */

  /**
   * event cache
   */

  /**
   * @inheritDoc
   */
   constructor(options = {}) {Offline.prototype.__init.call(this);
    this.maxStoredEvents = options.maxStoredEvents || 30; // set a reasonable default
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    this.offlineEventStore = localForage.default.createInstance({
      name: 'sentry/offlineEventStore',
    });
  }

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor, getCurrentHub) {
    this.hub = getCurrentHub();

    if ('addEventListener' in WINDOW) {
      WINDOW.addEventListener('online', () => {
        void this._sendEvents().catch(() => {
          (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('could not send cached events');
        });
      });
    }

    const eventProcessor = event => {
      if (this.hub && this.hub.getIntegration(Offline)) {
        // cache if we are positively offline
        if ('navigator' in WINDOW && 'onLine' in WINDOW.navigator && !WINDOW.navigator.onLine) {
          (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Event dropped due to being a offline - caching instead');

          void this._cacheEvent(event)
            .then((_event) => this._enforceMaxEvents())
            .catch((_error) => {
              (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('could not cache event while offline');
            });

          // return null on success or failure, because being offline will still result in an error
          return null;
        }
      }

      return event;
    };

    eventProcessor.id = this.name;
    addGlobalEventProcessor(eventProcessor);

    // if online now, send any events stored in a previous offline session
    if ('navigator' in WINDOW && 'onLine' in WINDOW.navigator && WINDOW.navigator.onLine) {
      void this._sendEvents().catch(() => {
        (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('could not send cached events');
      });
    }
  }

  /**
   * cache an event to send later
   * @param event an event
   */
   async _cacheEvent(event) {
    return this.offlineEventStore.setItem(utils.uuid4(), utils.normalize(event));
  }

  /**
   * purge excess events if necessary
   */
   async _enforceMaxEvents() {
    const events = [];

    return this.offlineEventStore
      .iterate((event, cacheKey, _index) => {
        // aggregate events
        events.push({ cacheKey, event });
      })
      .then(
        () =>
          // this promise resolves when the iteration is finished
          this._purgeEvents(
            // purge all events past maxStoredEvents in reverse chronological order
            events
              .sort((a, b) => (b.event.timestamp || 0) - (a.event.timestamp || 0))
              .slice(this.maxStoredEvents < events.length ? this.maxStoredEvents : events.length)
              .map(event => event.cacheKey),
          ),
      )
      .catch((_error) => {
        (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('could not enforce max events');
      });
  }

  /**
   * purge event from cache
   */
   async _purgeEvent(cacheKey) {
    return this.offlineEventStore.removeItem(cacheKey);
  }

  /**
   * purge events from cache
   */
   async _purgeEvents(cacheKeys) {
    // trail with .then to ensure the return type as void and not void|void[]
    return Promise.all(cacheKeys.map(cacheKey => this._purgeEvent(cacheKey))).then();
  }

  /**
   * send all events
   */
   async _sendEvents() {
    return this.offlineEventStore.iterate((event, cacheKey, _index) => {
      if (this.hub) {
        this.hub.captureEvent(event);

        void this._purgeEvent(cacheKey).catch((_error) => {
          (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('could not purge event from cache');
        });
      } else {
        (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('no hub found - could not send cached event');
      }
    });
  }
} Offline.__initStatic();

exports.Offline = Offline;
//# sourceMappingURL=offline.js.map


/***/ }),

/***/ 2285:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

const WINDOW = utils.GLOBAL_OBJ ;

/** Reporting API integration - https://w3c.github.io/reporting/ */
class ReportingObserver  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'ReportingObserver';}

  /**
   * @inheritDoc
   */
    __init() {this.name = ReportingObserver.id;}

  /**
   * Returns current hub.
   */

  /**
   * @inheritDoc
   */
   constructor(
      _options

 = {
      types: ['crash', 'deprecation', 'intervention'],
    },
  ) {this._options = _options;ReportingObserver.prototype.__init.call(this);}

  /**
   * @inheritDoc
   */
   setupOnce(_, getCurrentHub) {
    if (!utils.supportsReportingObserver()) {
      return;
    }

    this._getCurrentHub = getCurrentHub;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const observer = new (WINDOW ).ReportingObserver(this.handler.bind(this), {
      buffered: true,
      types: this._options.types,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    observer.observe();
  }

  /**
   * @inheritDoc
   */
   handler(reports) {
    const hub = this._getCurrentHub && this._getCurrentHub();
    if (!hub || !hub.getIntegration(ReportingObserver)) {
      return;
    }
    for (const report of reports) {
      hub.withScope(scope => {
        scope.setExtra('url', report.url);

        const label = `ReportingObserver [${report.type}]`;
        let details = 'No details available';

        if (report.body) {
          // Object.keys doesn't work on ReportBody, as all properties are inheirted
          const plainBody

 = {};

          // eslint-disable-next-line guard-for-in
          for (const prop in report.body) {
            plainBody[prop] = report.body[prop];
          }

          scope.setExtra('body', plainBody);

          if (report.type === 'crash') {
            const body = report.body ;
            // A fancy way to create a message out of crashId OR reason OR both OR fallback
            details = [body.crashId || '', body.reason || ''].join(' ').trim() || details;
          } else {
            const body = report.body ;
            details = body.message || details;
          }
        }

        hub.captureMessage(`${label}: ${details}`);
      });
    }
  }
} ReportingObserver.__initStatic();

exports.ReportingObserver = ReportingObserver;
//# sourceMappingURL=reportingobserver.js.map


/***/ }),

/***/ 5738:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

/** Rewrite event frames paths */
class RewriteFrames  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'RewriteFrames';}

  /**
   * @inheritDoc
   */
   __init() {this.name = RewriteFrames.id;}

  /**
   * @inheritDoc
   */

  /**
   * @inheritDoc
   */
    __init2() {this._prefix = 'app:///';}

  /**
   * @inheritDoc
   */
   constructor(options = {}) {RewriteFrames.prototype.__init.call(this);RewriteFrames.prototype.__init2.call(this);RewriteFrames.prototype.__init3.call(this);
    if (options.root) {
      this._root = options.root;
    }
    if (options.prefix) {
      this._prefix = options.prefix;
    }
    if (options.iteratee) {
      this._iteratee = options.iteratee;
    }
  }

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor, getCurrentHub) {
    addGlobalEventProcessor(event => {
      const self = getCurrentHub().getIntegration(RewriteFrames);
      if (self) {
        return self.process(event);
      }
      return event;
    });
  }

  /** JSDoc */
   process(originalEvent) {
    let processedEvent = originalEvent;

    if (originalEvent.exception && Array.isArray(originalEvent.exception.values)) {
      processedEvent = this._processExceptionsEvent(processedEvent);
    }

    return processedEvent;
  }

  /**
   * @inheritDoc
   */
    __init3() {this._iteratee = (frame) => {
    if (!frame.filename) {
      return frame;
    }
    // Check if the frame filename begins with `/` or a Windows-style prefix such as `C:\`
    const isWindowsFrame = /^[A-Z]:\\/.test(frame.filename);
    const startsWithSlash = /^\//.test(frame.filename);
    if (isWindowsFrame || startsWithSlash) {
      const filename = isWindowsFrame
        ? frame.filename
            .replace(/^[A-Z]:/, '') // remove Windows-style prefix
            .replace(/\\/g, '/') // replace all `\\` instances with `/`
        : frame.filename;
      const base = this._root ? utils.relative(this._root, filename) : utils.basename(filename);
      frame.filename = `${this._prefix}${base}`;
    }
    return frame;
  };}

  /** JSDoc */
   _processExceptionsEvent(event) {
    try {
      return {
        ...event,
        exception: {
          ...event.exception,
          // The check for this is performed inside `process` call itself, safe to skip here
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          values: event.exception.values.map(value => ({
            ...value,
            ...(value.stacktrace && { stacktrace: this._processStacktrace(value.stacktrace) }),
          })),
        },
      };
    } catch (_oO) {
      return event;
    }
  }

  /** JSDoc */
   _processStacktrace(stacktrace) {
    return {
      ...stacktrace,
      frames: stacktrace && stacktrace.frames && stacktrace.frames.map(f => this._iteratee(f)),
    };
  }
} RewriteFrames.__initStatic();

exports.RewriteFrames = RewriteFrames;
//# sourceMappingURL=rewriteframes.js.map


/***/ }),

/***/ 8304:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/** This function adds duration since Sentry was initialized till the time event was sent */
class SessionTiming  {constructor() { SessionTiming.prototype.__init.call(this);SessionTiming.prototype.__init2.call(this); }
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'SessionTiming';}

  /**
   * @inheritDoc
   */
   __init() {this.name = SessionTiming.id;}

  /** Exact time Client was initialized expressed in milliseconds since Unix Epoch. */
    __init2() {this._startTime = Date.now();}

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor, getCurrentHub) {
    addGlobalEventProcessor(event => {
      const self = getCurrentHub().getIntegration(SessionTiming);
      if (self) {
        return self.process(event);
      }
      return event;
    });
  }

  /**
   * @inheritDoc
   */
   process(event) {
    const now = Date.now();

    return {
      ...event,
      extra: {
        ...event.extra,
        ['session:start']: this._startTime,
        ['session:duration']: now - this._startTime,
        ['session:end']: now,
      },
    };
  }
} SessionTiming.__initStatic();

exports.SessionTiming = SessionTiming;
//# sourceMappingURL=sessiontiming.js.map


/***/ }),

/***/ 7987:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/** Add node transaction to the event */
class Transaction  {constructor() { Transaction.prototype.__init.call(this); }
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Transaction';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Transaction.id;}

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor, getCurrentHub) {
    addGlobalEventProcessor(event => {
      const self = getCurrentHub().getIntegration(Transaction);
      if (self) {
        return self.process(event);
      }
      return event;
    });
  }

  /**
   * @inheritDoc
   */
   process(event) {
    const frames = this._getFramesFromEvent(event);

    // use for loop so we don't have to reverse whole frames array
    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i];

      if (frame.in_app === true) {
        event.transaction = this._getTransaction(frame);
        break;
      }
    }

    return event;
  }

  /** JSDoc */
   _getFramesFromEvent(event) {
    const exception = event.exception && event.exception.values && event.exception.values[0];
    return (exception && exception.stacktrace && exception.stacktrace.frames) || [];
  }

  /** JSDoc */
   _getTransaction(frame) {
    return frame.module || frame.function ? `${frame.module || '?'}/${frame.function || '?'}` : '<unknown>';
  }
} Transaction.__initStatic();

exports.Transaction = Transaction;
//# sourceMappingURL=transaction.js.map


/***/ }),

/***/ 4165:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);

/** Platform-agnostic version of `flush` */
function flush(timeout) {
  const client = core.getCurrentHub().getClient();
  return client ? client.flush(timeout) : Promise.resolve(false);
}

/**
 * Capture the exception passed by nextjs to the `_error` page, adding context data as appropriate.
 *
 * @param contextOrProps The data passed to either `getInitialProps` or `render` by nextjs
 */
async function captureUnderscoreErrorException(contextOrProps) {
  const { req, res, err } = contextOrProps;

  // 404s (and other 400-y friends) can trigger `_error`, but we don't want to send them to Sentry
  const statusCode = (res && res.statusCode) || contextOrProps.statusCode;
  if (statusCode && statusCode < 500) {
    return Promise.resolve();
  }

  // In previous versions of the suggested `_error.js` page in which this function is meant to be used, there was a
  // workaround for https://github.com/vercel/next.js/issues/8592 which involved an extra call to this function, in the
  // custom error component's `render` method, just in case it hadn't been called by `getInitialProps`. Now that that
  // issue has been fixed, the second call is unnecessary, but since it lives in user code rather than our code, users
  // have to be the ones to get rid of it, and guaraneteedly, not all of them will. So, rather than capture the error
  // twice, we just bail if we sense we're in that now-extraneous second call. (We can tell which function we're in
  // because Nextjs passes `pathname` to `getInitialProps` but not to `render`.)
  if (!contextOrProps.pathname) {
    return Promise.resolve();
  }

  core.withScope(scope => {
    scope.addEventProcessor(event => {
      utils.addExceptionMechanism(event, {
        type: 'instrument',
        handled: true,
        data: {
          function: '_error.getInitialProps',
        },
      });
      return event;
    });

    if (req) {
      scope.setSDKProcessingMetadata({ request: req });
    }

    // If third-party libraries (or users themselves) throw something falsy, we want to capture it as a message (which
    // is what passing a string to `captureException` will wind up doing)
    core.captureException(err || `_error.js called with falsy error (${err})`);
  });

  // In case this is being run as part of a serverless function (as is the case with the server half of nextjs apps
  // deployed to vercel), make sure the error gets sent to Sentry before the lambda exits.
  await flush(2000);
}

exports.captureUnderscoreErrorException = captureUnderscoreErrorException;
//# sourceMappingURL=_error.js.map


/***/ }),

/***/ 9970:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);

const PACKAGE_NAME_PREFIX = 'npm:@sentry/';

/**
 * A builder for the SDK metadata in the options for the SDK initialization.
 * @param options sdk options object that gets mutated
 * @param names list of package names
 */
function buildMetadata(options, names) {
  options._metadata = options._metadata || {};
  options._metadata.sdk =
    options._metadata.sdk ||
    ({
      name: 'sentry.javascript.nextjs',
      packages: names.map(name => ({
        name: `${PACKAGE_NAME_PREFIX}${name}`,
        version: core.SDK_VERSION,
      })),
      version: core.SDK_VERSION,
    } );
}

exports.buildMetadata = buildMetadata;
//# sourceMappingURL=metadata.js.map


/***/ }),

/***/ 391:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Recursively traverses an object to update an existing nested key.
 * Note: The provided key path must include existing properties,
 * the function will not create objects while traversing.
 *
 * @param obj An object to update
 * @param value The value to update the nested key with
 * @param keyPath The path to the key to update ex. fizz.buzz.foo
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setNestedKey(obj, keyPath, value) {
  // Ex. foo.bar.zoop will extract foo and bar.zoop
  const match = keyPath.match(/([a-z_]+)\.(.*)/i);
  // The match will be null when there's no more recursing to do, i.e., when we've reached the right level of the object
  if (match === null) {
    obj[keyPath] = value;
  } else {
    // `match[1]` is the initial segment of the path, and `match[2]` is the remainder of the path
    const innerObj = obj[match[1]];
    setNestedKey(innerObj, match[2], value);
  }
}

/**
 * Enforces inclusion of a given integration with specified options in an integration array originally determined by the
 * user, by either including the given default instance or by patching an existing user instance with the given options.
 *
 * Ideally this would happen when integrations are set up, but there isn't currently a mechanism there for merging
 * options from a default integration instance with those from a user-provided instance of the same integration, only
 * for allowing the user to override a default instance entirely. (TODO: Fix that.)
 *
 * @param defaultIntegrationInstance An instance of the integration with the correct options already set
 * @param userIntegrations Integrations defined by the user.
 * @param forcedOptions Options with which to patch an existing user-derived instance on the integration.
 * @returns A final integrations array.
 */
function addOrUpdateIntegration(
  defaultIntegrationInstance,
  userIntegrations,
  forcedOptions = {},
) {
  return (
    Array.isArray(userIntegrations)
      ? addOrUpdateIntegrationInArray(defaultIntegrationInstance, userIntegrations, forcedOptions)
      : addOrUpdateIntegrationInFunction(
          defaultIntegrationInstance,
          // Somehow TS can't figure out that not being an array makes this necessarily a function
          userIntegrations ,
          forcedOptions,
        )
  ) ;
}

function addOrUpdateIntegrationInArray(
  defaultIntegrationInstance,
  userIntegrations,
  forcedOptions,
) {
  const userInstance = userIntegrations.find(integration => integration.name === defaultIntegrationInstance.name);

  if (userInstance) {
    for (const [keyPath, value] of Object.entries(forcedOptions)) {
      setNestedKey(userInstance, keyPath, value);
    }

    return userIntegrations;
  }

  return [...userIntegrations, defaultIntegrationInstance];
}

function addOrUpdateIntegrationInFunction(
  defaultIntegrationInstance,
  userIntegrationsFunc,
  forcedOptions,
) {
  const wrapper = defaultIntegrations => {
    const userFinalIntegrations = userIntegrationsFunc(defaultIntegrations);

    // There are instances where we want the user to be able to prevent an integration from appearing at all, which they
    // would do by providing a function which filters out the integration in question. If that's happened in one of
    // those cases, don't add our default back in.
    if (defaultIntegrationInstance.allowExclusionByUser) {
      const userFinalInstance = userFinalIntegrations.find(
        integration => integration.name === defaultIntegrationInstance.name,
      );
      if (!userFinalInstance) {
        return userFinalIntegrations;
      }
    }

    return addOrUpdateIntegrationInArray(defaultIntegrationInstance, userFinalIntegrations, forcedOptions);
  };

  return wrapper;
}

exports.addOrUpdateIntegration = addOrUpdateIntegration;
//# sourceMappingURL=userIntegrations.js.map


/***/ }),

/***/ 2001:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony import */ var _server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3839);
/* harmony import */ var _server__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_server__WEBPACK_IMPORTED_MODULE_0__);
/* harmony reexport (checked) */ if(__webpack_require__.o(_server__WEBPACK_IMPORTED_MODULE_0__, "captureException")) __webpack_require__.d(__webpack_exports__, { "captureException": function() { return _server__WEBPACK_IMPORTED_MODULE_0__.captureException; } });
/* harmony reexport (checked) */ if(__webpack_require__.o(_server__WEBPACK_IMPORTED_MODULE_0__, "wrapAppDirComponentWithSentry")) __webpack_require__.d(__webpack_exports__, { "wrapAppDirComponentWithSentry": function() { return _server__WEBPACK_IMPORTED_MODULE_0__.wrapAppDirComponentWithSentry; } });


/***/ }),

/***/ 3839:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const integrations = __webpack_require__(1680);
const node = __webpack_require__(5529);
const tracing = __webpack_require__(7363);
const utils = __webpack_require__(9425);
const domain$1 = __webpack_require__(3639);
const path = __webpack_require__(1017);
const metadata = __webpack_require__(9970);
const userIntegrations = __webpack_require__(391);
const isBuild = __webpack_require__(9662);
const _error = __webpack_require__(4165);
const wrapGetStaticPropsWithSentry = __webpack_require__(4675);
const wrapGetInitialPropsWithSentry = __webpack_require__(9751);
const wrapAppGetInitialPropsWithSentry = __webpack_require__(3765);
const wrapDocumentGetInitialPropsWithSentry = __webpack_require__(1148);
const wrapErrorGetInitialPropsWithSentry = __webpack_require__(8833);
const wrapGetServerSidePropsWithSentry = __webpack_require__(7179);
const wrapApiHandlerWithSentry = __webpack_require__(2371);
const wrapAppDirComponentWithSentry = __webpack_require__(9739);

/**
 * A passthrough error boundary for the server that doesn't depend on any react. Error boundaries don't catch SSR errors
 * so they should simply be a passthrough.
 */
const ErrorBoundary = (props) => {
  if (!props.children) {
    return null;
  }

  if (typeof props.children === 'function') {
    return (props.children )();
  }

  // since Next.js >= 10 requires React ^16.6.0 we are allowed to return children like this here
  return props.children ;
};

/**
 * A passthrough error boundary wrapper for the server that doesn't depend on any react. Error boundaries don't catch
 * SSR errors so they should simply be a passthrough.
 */
function withErrorBoundary(
  WrappedComponent,
) {
  return WrappedComponent ;
}

/**
 * Just a passthrough since we're on the server and showing the report dialog on the server doesn't make any sense.
 */
function showReportDialog() {
  return;
}

const globalWithInjectedValues = global

;

const domain = domain$1 ;

// TODO (v8): Remove this
/**
 * @deprecated This constant will be removed in the next major update.
 */
const IS_BUILD = isBuild.isBuild();

const IS_VERCEL = !!process.env.VERCEL;

/** Inits the Sentry NextJS SDK on node. */
function init(options) {
  if ((typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && options.debug) {
    utils.logger.enable();
  }

  (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Initializing SDK...');

  if (sdkAlreadyInitialized()) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('SDK already initialized');
    return;
  }

  metadata.buildMetadata(options, ['nextjs', 'node']);
  options.environment = options.environment || "production";
  addServerIntegrations(options);
  // Right now we only capture frontend sessions for Next.js
  options.autoSessionTracking = false;

  // In an ideal world, this init function would be called before any requests are handled. That way, every domain we
  // use to wrap a request would inherit its scope and client from the global hub. In practice, however, handling the
  // first request is what causes us to initialize the SDK, as the init code is injected into `_app` and all API route
  // handlers, and those are only accessed in the course of handling a request. As a result, we're already in a domain
  // when `init` is called. In order to compensate for this and mimic the ideal world scenario, we stash the active
  // domain, run `init` as normal, and then restore the domain afterwards, copying over data from the main hub as if we
  // really were inheriting.
  const activeDomain = domain.active;
  domain.active = null;

  node.init(options);

  const filterTransactions = event => {
    return event.type === 'transaction' && event.transaction === '/404' ? null : event;
  };

  filterTransactions.id = 'NextServer404TransactionFilter';

  node.configureScope(scope => {
    scope.setTag('runtime', 'node');
    if (IS_VERCEL) {
      scope.setTag('vercel', true);
    }

    scope.addEventProcessor(filterTransactions);
  });

  if (activeDomain) {
    const globalHub = core.getHubFromCarrier(core.getMainCarrier());
    const domainHub = core.getHubFromCarrier(activeDomain);

    // apply the changes made by `nodeInit` to the domain's hub also
    domainHub.bindClient(globalHub.getClient());
    _optionalChain([domainHub, 'access', _ => _.getScope, 'call', _2 => _2(), 'optionalAccess', _3 => _3.update, 'call', _4 => _4(globalHub.getScope())]);
    // `scope.update()` doesn’t copy over event processors, so we have to add it manually
    _optionalChain([domainHub, 'access', _5 => _5.getScope, 'call', _6 => _6(), 'optionalAccess', _7 => _7.addEventProcessor, 'call', _8 => _8(filterTransactions)]);

    // restore the domain hub as the current one
    domain.active = activeDomain;
  }

  (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('SDK successfully initialized');
}

function sdkAlreadyInitialized() {
  const hub = node.getCurrentHub();
  return !!hub.getClient();
}

function addServerIntegrations(options) {
  let integrations$1 = options.integrations || [];

  // This value is injected at build time, based on the output directory specified in the build config. Though a default
  // is set there, we set it here as well, just in case something has gone wrong with the injection.
  const distDirName = globalWithInjectedValues.__rewriteFramesDistDir__ || '.next';
  // nextjs always puts the build directory at the project root level, which is also where you run `next start` from, so
  // we can read in the project directory from the currently running process
  const distDirAbsPath = path.resolve(process.cwd(), distDirName);
  const SOURCEMAP_FILENAME_REGEX = new RegExp(utils.escapeStringForRegex(distDirAbsPath));

  const defaultRewriteFramesIntegration = new integrations.RewriteFrames({
    iteratee: frame => {
      frame.filename = _optionalChain([frame, 'access', _9 => _9.filename, 'optionalAccess', _10 => _10.replace, 'call', _11 => _11(SOURCEMAP_FILENAME_REGEX, 'app:///_next')]);
      return frame;
    },
  });
  integrations$1 = userIntegrations.addOrUpdateIntegration(defaultRewriteFramesIntegration, integrations$1);

  const defaultOnUncaughtExceptionIntegration = new node.Integrations.OnUncaughtException({
    exitEvenIfOtherHandlersAreRegistered: false,
  });
  defaultOnUncaughtExceptionIntegration.allowExclusionByUser = true;
  integrations$1 = userIntegrations.addOrUpdateIntegration(defaultOnUncaughtExceptionIntegration, integrations$1, {
    _options: { exitEvenIfOtherHandlersAreRegistered: false },
  });

  if (tracing.hasTracingEnabled(options)) {
    const defaultHttpTracingIntegration = new node.Integrations.Http({ tracing: true });
    integrations$1 = userIntegrations.addOrUpdateIntegration(defaultHttpTracingIntegration, integrations$1, {
      _tracing: {},
    });
  }

  options.integrations = integrations$1;
}

// TODO (v8): Remove this
/**
 * @deprecated This constant will be removed in the next major update.
 */
const deprecatedIsBuild = () => isBuild.isBuild();

exports.captureUnderscoreErrorException = _error.captureUnderscoreErrorException;
exports.withSentryGetStaticProps = wrapGetStaticPropsWithSentry.withSentryGetStaticProps;
exports.wrapGetStaticPropsWithSentry = wrapGetStaticPropsWithSentry.wrapGetStaticPropsWithSentry;
exports.withSentryServerSideGetInitialProps = wrapGetInitialPropsWithSentry.withSentryServerSideGetInitialProps;
exports.wrapGetInitialPropsWithSentry = wrapGetInitialPropsWithSentry.wrapGetInitialPropsWithSentry;
exports.withSentryServerSideAppGetInitialProps = wrapAppGetInitialPropsWithSentry.withSentryServerSideAppGetInitialProps;
exports.wrapAppGetInitialPropsWithSentry = wrapAppGetInitialPropsWithSentry.wrapAppGetInitialPropsWithSentry;
exports.withSentryServerSideDocumentGetInitialProps = wrapDocumentGetInitialPropsWithSentry.withSentryServerSideDocumentGetInitialProps;
exports.wrapDocumentGetInitialPropsWithSentry = wrapDocumentGetInitialPropsWithSentry.wrapDocumentGetInitialPropsWithSentry;
exports.withSentryServerSideErrorGetInitialProps = wrapErrorGetInitialPropsWithSentry.withSentryServerSideErrorGetInitialProps;
exports.wrapErrorGetInitialPropsWithSentry = wrapErrorGetInitialPropsWithSentry.wrapErrorGetInitialPropsWithSentry;
exports.withSentryGetServerSideProps = wrapGetServerSidePropsWithSentry.withSentryGetServerSideProps;
exports.wrapGetServerSidePropsWithSentry = wrapGetServerSidePropsWithSentry.wrapGetServerSidePropsWithSentry;
exports.withSentry = wrapApiHandlerWithSentry.withSentry;
exports.withSentryAPI = wrapApiHandlerWithSentry.withSentryAPI;
exports.wrapApiHandlerWithSentry = wrapApiHandlerWithSentry.wrapApiHandlerWithSentry;
exports.wrapAppDirComponentWithSentry = wrapAppDirComponentWithSentry.wrapAppDirComponentWithSentry;
exports.ErrorBoundary = ErrorBoundary;
exports.IS_BUILD = IS_BUILD;
exports.init = init;
exports.isBuild = deprecatedIsBuild;
exports.showReportDialog = showReportDialog;
exports.withErrorBoundary = withErrorBoundary;
for (const k in node) {
  if (k !== 'default' && !exports.hasOwnProperty(k)) exports[k] = node[k];
}
//# sourceMappingURL=index.js.map


/***/ }),

/***/ 9662:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const constants = __webpack_require__(7527);

/**
 * Decide if the currently running process is part of the build phase or happening at runtime.
 */
function isBuild() {
  return process.env.NEXT_PHASE === constants.PHASE_PRODUCTION_BUILD;
}

exports.isBuild = isBuild;
//# sourceMappingURL=isBuild.js.map


/***/ }),

/***/ 9578:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const platformSupportsStreaming = () => !process.env.LAMBDA_TASK_ROOT && !process.env.VERCEL;

exports.platformSupportsStreaming = platformSupportsStreaming;
//# sourceMappingURL=platformSupportsStreaming.js.map


/***/ }),

/***/ 9601:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const node = __webpack_require__(5529);
const utils = __webpack_require__(9425);

/**
 * Wrap `res.end()` so that it closes the transaction and flushes events before letting the request finish.
 *
 * Note: This wraps a sync method with an async method. While in general that's not a great idea in terms of keeping
 * things in the right order, in this case it's safe, because the native `.end()` actually *is* (effectively) async, and
 * its run actually *is* (literally) awaited, just manually so (which reflects the fact that the core of the
 * request/response code in Node by far predates the introduction of `async`/`await`). When `.end()` is done, it emits
 * the `prefinish` event, and only once that fires does request processing continue. See
 * https://github.com/nodejs/node/commit/7c9b607048f13741173d397795bac37707405ba7.
 *
 * Also note: `res.end()` isn't called until *after* all response data and headers have been sent, so blocking inside of
 * `end` doesn't delay data getting to the end user. See
 * https://nodejs.org/api/http.html#responseenddata-encoding-callback.
 *
 * @param transaction The transaction tracing request handling
 * @param res: The request's corresponding response
 */
function autoEndTransactionOnResponseEnd(transaction, res) {
  const wrapEndMethod = (origEnd) => {
    return function sentryWrappedEnd( ...args) {
      void finishTransaction(transaction, this);
      return origEnd.call(this, ...args);
    };
  };

  // Prevent double-wrapping
  // res.end may be undefined during build when using `next export` to statically export a Next.js app
  if (res.end && !(res.end ).__sentry_original__) {
    utils.fill(res, 'end', wrapEndMethod);
  }
}

/** Finish the given response's transaction and set HTTP status data */
async function finishTransaction(transaction, res) {
  if (transaction) {
    transaction.setHttpStatus(res.statusCode);

    // If any open spans are set to finish when the response ends, it sets up a race condition between their `finish`
    // calls and the transaction's `finish` call - and any spans which lose the race will get dropped from the
    // transaction. To prevent this, push `transaction.finish` to the next event loop so that it's guaranteed to lose
    // the race, and wait for it to be done before flushing events.
    const transactionFinished = new Promise(resolve => {
      setImmediate(() => {
        transaction.finish();
        resolve();
      });
    });
    await transactionFinished;
  }
}

/** Flush the event queue to ensure that events get sent to Sentry before the response is finished and the lambda ends */
async function flushQueue() {
  try {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Flushing events...');
    await node.flush(2000);
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Done flushing events');
  } catch (e) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Error while flushing events:\n', e);
  }
}

exports.autoEndTransactionOnResponseEnd = autoEndTransactionOnResponseEnd;
exports.finishTransaction = finishTransaction;
exports.flushQueue = flushQueue;
//# sourceMappingURL=responseEnd.js.map


/***/ }),

/***/ 4850:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const tracing = __webpack_require__(7363);
const utils = __webpack_require__(9425);
const domain = __webpack_require__(3639);
const platformSupportsStreaming = __webpack_require__(9578);
const responseEnd = __webpack_require__(9601);

/**
 * Grabs a transaction off a Next.js datafetcher request object, if it was previously put there via
 * `setTransactionOnRequest`.
 *
 * @param req The Next.js datafetcher request object
 * @returns the Transaction on the request object if there is one, or `undefined` if the request object didn't have one.
 */
function getTransactionFromRequest(req) {
  return req._sentryTransaction;
}

function setTransactionOnRequest(transaction, req) {
  req._sentryTransaction = transaction;
}

/**
 * Wraps a function that potentially throws. If it does, the error is passed to `captureException` and rethrown.
 *
 * Note: This function turns the wrapped function into an asynchronous one.
 */
function withErrorInstrumentation(
  origFunction,
) {
  return async function ( ...origFunctionArguments) {
    try {
      return await origFunction.apply(this, origFunctionArguments);
    } catch (e) {
      // TODO: Extract error logic from `withSentry` in here or create a new wrapper with said logic or something like that.
      core.captureException(e);
      throw e;
    }
  };
}

/**
 * Calls a server-side data fetching function (that takes a `req` and `res` object in its context) with tracing
 * instrumentation. A transaction will be created for the incoming request (if it doesn't already exist) in addition to
 * a span for the wrapped data fetching function.
 *
 * All of the above happens in an isolated domain, meaning all thrown errors will be associated with the correct span.
 *
 * @param origDataFetcher The data fetching method to call.
 * @param origFunctionArguments The arguments to call the data fetching method with.
 * @param req The data fetching function's request object.
 * @param res The data fetching function's response object.
 * @param options Options providing details for the created transaction and span.
 * @returns what the data fetching method call returned.
 */
function withTracedServerSideDataFetcher(
  origDataFetcher,
  req,
  res,
  options

,
) {
  return async function ( ...args) {
    return domain.create().bind(async () => {
      let requestTransaction = getTransactionFromRequest(req);
      let dataFetcherSpan;

      const sentryTraceHeader = req.headers['sentry-trace'];
      const rawBaggageString = req.headers && req.headers.baggage;
      const traceparentData =
        typeof sentryTraceHeader === 'string' ? utils.extractTraceparentData(sentryTraceHeader) : undefined;

      const dynamicSamplingContext = utils.baggageHeaderToDynamicSamplingContext(rawBaggageString);

      if (platformSupportsStreaming.platformSupportsStreaming()) {
        if (requestTransaction === undefined) {
          const newTransaction = core.startTransaction(
            {
              op: 'http.server',
              name: options.requestedRouteName,
              ...traceparentData,
              status: 'ok',
              metadata: {
                request: req,
                source: 'route',
                dynamicSamplingContext: traceparentData && !dynamicSamplingContext ? {} : dynamicSamplingContext,
              },
            },
            { request: req },
          );

          requestTransaction = newTransaction;

          if (platformSupportsStreaming.platformSupportsStreaming()) {
            // On platforms that don't support streaming, doing things after res.end() is unreliable.
            responseEnd.autoEndTransactionOnResponseEnd(newTransaction, res);
          }

          // Link the transaction and the request together, so that when we would normally only have access to one, it's
          // still possible to grab the other.
          setTransactionOnRequest(newTransaction, req);
        }

        dataFetcherSpan = requestTransaction.startChild({
          op: 'function.nextjs',
          description: `${options.dataFetchingMethodName} (${options.dataFetcherRouteName})`,
          status: 'ok',
        });
      } else {
        dataFetcherSpan = core.startTransaction({
          op: 'function.nextjs',
          name: `${options.dataFetchingMethodName} (${options.dataFetcherRouteName})`,
          ...traceparentData,
          status: 'ok',
          metadata: {
            request: req,
            source: 'route',
            dynamicSamplingContext: traceparentData && !dynamicSamplingContext ? {} : dynamicSamplingContext,
          },
        });
      }

      const currentScope = core.getCurrentHub().getScope();
      if (currentScope) {
        currentScope.setSpan(dataFetcherSpan);
        currentScope.setSDKProcessingMetadata({ request: req });
      }

      try {
        return await origDataFetcher.apply(this, args);
      } catch (e) {
        // Since we finish the span before the error can bubble up and trigger the handlers in `registerErrorInstrumentation`
        // that set the transaction status, we need to manually set the status of the span & transaction
        dataFetcherSpan.setStatus('internal_error');
        _optionalChain([requestTransaction, 'optionalAccess', _ => _.setStatus, 'call', _2 => _2('internal_error')]);
        throw e;
      } finally {
        dataFetcherSpan.finish();
        if (!platformSupportsStreaming.platformSupportsStreaming()) {
          await responseEnd.flushQueue();
        }
      }
    })();
  };
}

/**
 * Call a data fetcher and trace it. Only traces the function if there is an active transaction on the scope.
 *
 * We only do the following until we move transaction creation into this function: When called, the wrapped function
 * will also update the name of the active transaction with a parameterized route provided via the `options` argument.
 */
async function callDataFetcherTraced(
  origFunction,
  origFunctionArgs,
  options

,
) {
  const { parameterizedRoute, dataFetchingMethodName } = options;

  const transaction = tracing.getActiveTransaction();

  if (!transaction) {
    return origFunction(...origFunctionArgs);
  }

  // TODO: Make sure that the given route matches the name of the active transaction (to prevent background data
  // fetching from switching the name to a completely other route) -- We'll probably switch to creating a transaction
  // right here so making that check will probabably not even be necessary.
  // Logic will be: If there is no active transaction, start one with correct name and source. If there is an active
  // transaction, create a child span with correct name and source.
  transaction.name = parameterizedRoute;
  transaction.metadata.source = 'route';

  // Capture the route, since pre-loading, revalidation, etc might mean that this span may happen during another
  // route's transaction
  const span = transaction.startChild({
    op: 'function.nextjs',
    description: `${dataFetchingMethodName} (${parameterizedRoute})`,
    status: 'ok',
  });

  try {
    return await origFunction(...origFunctionArgs);
  } catch (err) {
    // Since we finish the span before the error can bubble up and trigger the handlers in `registerErrorInstrumentation`
    // that set the transaction status, we need to manually set the status of the span & transaction
    transaction.setStatus('internal_error');
    span.setStatus('internal_error');
    span.finish();

    // TODO Copy more robust error handling over from `withSentry`
    core.captureException(err);
    throw err;
  }
}

exports.callDataFetcherTraced = callDataFetcherTraced;
exports.getTransactionFromRequest = getTransactionFromRequest;
exports.withErrorInstrumentation = withErrorInstrumentation;
exports.withTracedServerSideDataFetcher = withTracedServerSideDataFetcher;
//# sourceMappingURL=wrapperUtils.js.map


/***/ }),

/***/ 2371:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const node = __webpack_require__(5529);
const tracing = __webpack_require__(7363);
const utils = __webpack_require__(9425);
const domain = __webpack_require__(3639);
const platformSupportsStreaming = __webpack_require__(9578);
const responseEnd = __webpack_require__(9601);

/**
 * Wrap the given API route handler for tracing and error capturing. Thin wrapper around `withSentry`, which only
 * applies it if it hasn't already been applied.
 *
 * @param apiHandler The handler exported from the user's API page route file, which may or may not already be
 * wrapped with `withSentry`
 * @param parameterizedRoute The page's route, passed in via the proxy loader
 * @returns The wrapped handler
 */
function wrapApiHandlerWithSentry(apiHandler, parameterizedRoute) {
  return new Proxy(apiHandler, {
    apply: async (wrappingTarget, thisArg, args) => {
      // eslint-disable-next-line deprecation/deprecation
      return withSentry(wrappingTarget, parameterizedRoute).apply(thisArg, args);
    },
  });
}

/**
 * @deprecated Use `wrapApiHandlerWithSentry()` instead
 */
const withSentryAPI = wrapApiHandlerWithSentry;

/**
 * Legacy function for manually wrapping API route handlers, now used as the innards of `wrapApiHandlerWithSentry`.
 *
 * @param apiHandler The user's original API route handler
 * @param parameterizedRoute The route whose handler is being wrapped. Meant for internal use only.
 * @returns A wrapped version of the handler
 *
 * @deprecated Use `wrapApiWithSentry()` instead
 */
function withSentry(apiHandler, parameterizedRoute) {
  return new Proxy(apiHandler, {
    apply: async (wrappingTarget, thisArg, args) => {
      const [req, res] = args;

      // We're now auto-wrapping API route handlers using `wrapApiHandlerWithSentry` (which uses `withSentry` under the hood), but
      // users still may have their routes manually wrapped with `withSentry`. This check makes `sentryWrappedHandler`
      // idempotent so that those cases don't break anything.
      if (req.__withSentry_applied__) {
        return wrappingTarget.apply(thisArg, args);
      }
      req.__withSentry_applied__ = true;

      // use a domain in order to prevent scope bleed between requests
      const local = domain.create();
      local.add(req);
      local.add(res);

      // `local.bind` causes everything to run inside a domain, just like `local.run` does, but it also lets the callback
      // return a value. In our case, all any of the codepaths return is a promise of `void`, but nextjs still counts on
      // getting that before it will finish the response.
      // eslint-disable-next-line complexity
      const boundHandler = local.bind(async () => {
        let transaction;
        const hub = node.getCurrentHub();
        const currentScope = hub.getScope();
        const options = _optionalChain([hub, 'access', _ => _.getClient, 'call', _2 => _2(), 'optionalAccess', _3 => _3.getOptions, 'call', _4 => _4()]);

        if (currentScope) {
          currentScope.setSDKProcessingMetadata({ request: req });

          if (tracing.hasTracingEnabled(options) && _optionalChain([options, 'optionalAccess', _5 => _5.instrumenter]) === 'sentry') {
            // If there is a trace header set, extract the data from it (parentSpanId, traceId, and sampling decision)
            let traceparentData;
            if (req.headers && utils.isString(req.headers['sentry-trace'])) {
              traceparentData = tracing.extractTraceparentData(req.headers['sentry-trace']);
              (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`[Tracing] Continuing trace ${_optionalChain([traceparentData, 'optionalAccess', _6 => _6.traceId])}.`);
            }

            const baggageHeader = req.headers && req.headers.baggage;
            const dynamicSamplingContext = utils.baggageHeaderToDynamicSamplingContext(baggageHeader);

            // prefer the parameterized route, if we have it (which we will if we've auto-wrapped the route handler)
            let reqPath = parameterizedRoute;

            // If not, fake it by just replacing parameter values with their names, hoping that none of them match either
            // each other or any hard-coded parts of the path
            if (!reqPath) {
              const url = `${req.url}`;
              // pull off query string, if any
              reqPath = utils.stripUrlQueryAndFragment(url);
              // Replace with placeholder
              if (req.query) {
                for (const [key, value] of Object.entries(req.query)) {
                  reqPath = reqPath.replace(`${value}`, `[${key}]`);
                }
              }
            }

            const reqMethod = `${(req.method || 'GET').toUpperCase()} `;

            transaction = node.startTransaction(
              {
                name: `${reqMethod}${reqPath}`,
                op: 'http.server',
                ...traceparentData,
                metadata: {
                  dynamicSamplingContext: traceparentData && !dynamicSamplingContext ? {} : dynamicSamplingContext,
                  source: 'route',
                  request: req,
                },
              },
              // extra context passed to the `tracesSampler`
              { request: req },
            );
            currentScope.setSpan(transaction);
            if (platformSupportsStreaming.platformSupportsStreaming() && !wrappingTarget.__sentry_test_doesnt_support_streaming__) {
              responseEnd.autoEndTransactionOnResponseEnd(transaction, res);
            } else {
              // If we're not on a platform that supports streaming, we're blocking res.end() until the queue is flushed.
              // res.json() and res.send() will implicitly call res.end(), so it is enough to wrap res.end().

              // eslint-disable-next-line @typescript-eslint/unbound-method
              const origResEnd = res.end;
              res.end = async function ( ...args) {
                if (transaction) {
                  await responseEnd.finishTransaction(transaction, res);
                  await responseEnd.flushQueue();
                }

                origResEnd.apply(this, args);
              };
            }
          }
        }

        try {
          const handlerResult = await wrappingTarget.apply(thisArg, args);

          if (
            false
            // This can only happen (not always) when the user is using `withSentry` manually, which we're deprecating.
            // Warning suppression on Next.JS is only necessary in that case.
          ) {}

          return handlerResult;
        } catch (e) {
          // In case we have a primitive, wrap it in the equivalent wrapper class (string -> String, etc.) so that we can
          // store a seen flag on it. (Because of the one-way-on-Vercel-one-way-off-of-Vercel approach we've been forced
          // to take, it can happen that the same thrown object gets caught in two different ways, and flagging it is a
          // way to prevent it from actually being reported twice.)
          const objectifiedErr = utils.objectify(e);

          if (currentScope) {
            currentScope.addEventProcessor(event => {
              utils.addExceptionMechanism(event, {
                type: 'instrument',
                handled: true,
                data: {
                  wrapped_handler: wrappingTarget.name,
                  function: 'withSentry',
                },
              });
              return event;
            });

            node.captureException(objectifiedErr);
          }

          // Because we're going to finish and send the transaction before passing the error onto nextjs, it won't yet
          // have had a chance to set the status to 500, so unless we do it ourselves now, we'll incorrectly report that
          // the transaction was error-free
          res.statusCode = 500;
          res.statusMessage = 'Internal Server Error';

          // Make sure we have a chance to finish the transaction and flush events to Sentry before the handler errors
          // out. (Apps which are deployed on Vercel run their API routes in lambdas, and those lambdas will shut down the
          // moment they detect an error, so it's important to get this done before rethrowing the error. Apps not
          // deployed serverlessly will run into this cleanup code again in `res.end(), but the transaction will already
          // be finished and the queue will already be empty, so effectively it'll just no-op.)
          if (platformSupportsStreaming.platformSupportsStreaming() && !wrappingTarget.__sentry_test_doesnt_support_streaming__) {
            void responseEnd.finishTransaction(transaction, res);
          } else {
            await responseEnd.finishTransaction(transaction, res);
            await responseEnd.flushQueue();
          }

          // We rethrow here so that nextjs can do with the error whatever it would normally do. (Sometimes "whatever it
          // would normally do" is to allow the error to bubble up to the global handlers - another reason we need to mark
          // the error as already having been captured.)
          throw objectifiedErr;
        }
      });

      // Since API route handlers are all async, nextjs always awaits the return value (meaning it's fine for us to return
      // a promise here rather than a real result, and it saves us the overhead of an `await` call.)
      return boundHandler();
    },
  });
}

exports.withSentry = withSentry;
exports.withSentryAPI = withSentryAPI;
exports.wrapApiHandlerWithSentry = wrapApiHandlerWithSentry;
//# sourceMappingURL=wrapApiHandlerWithSentry.js.map


/***/ }),

/***/ 9739:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);

/**
 * Wraps an `app` directory server component with Sentry error instrumentation.
 */
function wrapAppDirComponentWithSentry(appDirComponent) {
  // Even though users may define server components as async functions, for the client bundles
  // Next.js will turn them into synchronous functions and it will transform any`await`s into instances of the`use`
  // hook. 🤯
  return new Proxy(appDirComponent, {
    apply: (originalFunction, thisArg, args) => {
      let maybePromiseResult;

      try {
        maybePromiseResult = originalFunction.apply(thisArg, args);
      } catch (e) {
        core.captureException(e);
        throw e;
      }

      if (typeof maybePromiseResult === 'object' && maybePromiseResult !== null && 'then' in maybePromiseResult) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return maybePromiseResult.then(null, (e) => {
          core.captureException(e);
          throw e;
        });
      } else {
        return maybePromiseResult;
      }
    },
  });
}

exports.wrapAppDirComponentWithSentry = wrapAppDirComponentWithSentry;
//# sourceMappingURL=wrapAppDirComponentWithSentry.js.map


/***/ }),

/***/ 3765:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const node = __webpack_require__(5529);
const tracing = __webpack_require__(7363);
const utils = __webpack_require__(9425);
const isBuild = __webpack_require__(9662);
const wrapperUtils = __webpack_require__(4850);

/**
 * Create a wrapped version of the user's exported `getInitialProps` function in
 * a custom app ("_app.js").
 *
 * @param origAppGetInitialProps The user's `getInitialProps` function
 * @param parameterizedRoute The page's parameterized route
 * @returns A wrapped version of the function
 */
function wrapAppGetInitialPropsWithSentry(origAppGetInitialProps) {
  return new Proxy(origAppGetInitialProps, {
    apply: async (wrappingTarget, thisArg, args) => {
      if (isBuild.isBuild()) {
        return wrappingTarget.apply(thisArg, args);
      }

      const [context] = args;
      const { req, res } = context.ctx;

      const errorWrappedAppGetInitialProps = wrapperUtils.withErrorInstrumentation(wrappingTarget);
      const options = _optionalChain([node.getCurrentHub, 'call', _ => _(), 'access', _2 => _2.getClient, 'call', _3 => _3(), 'optionalAccess', _4 => _4.getOptions, 'call', _5 => _5()]);

      // Generally we can assume that `req` and `res` are always defined on the server:
      // https://nextjs.org/docs/api-reference/data-fetching/get-initial-props#context-object
      // This does not seem to be the case in dev mode. Because we have no clean way of associating the the data fetcher
      // span with each other when there are no req or res objects, we simply do not trace them at all here.
      if (tracing.hasTracingEnabled() && req && res && _optionalChain([options, 'optionalAccess', _6 => _6.instrumenter]) === 'sentry') {
        const tracedGetInitialProps = wrapperUtils.withTracedServerSideDataFetcher(errorWrappedAppGetInitialProps, req, res, {
          dataFetcherRouteName: '/_app',
          requestedRouteName: context.ctx.pathname,
          dataFetchingMethodName: 'getInitialProps',
        });

        const appGetInitialProps

 = await tracedGetInitialProps.apply(thisArg, args);

        const requestTransaction = wrapperUtils.getTransactionFromRequest(req);

        // Per definition, `pageProps` is not optional, however an increased amount of users doesn't seem to call
        // `App.getInitialProps(appContext)` in their custom `_app` pages which is required as per
        // https://nextjs.org/docs/advanced-features/custom-app - resulting in missing `pageProps`.
        // For this reason, we just handle the case where `pageProps` doesn't exist explicitly.
        if (!appGetInitialProps.pageProps) {
          appGetInitialProps.pageProps = {};
        }

        if (requestTransaction) {
          appGetInitialProps.pageProps._sentryTraceData = requestTransaction.toTraceparent();

          const dynamicSamplingContext = requestTransaction.getDynamicSamplingContext();
          appGetInitialProps.pageProps._sentryBaggage =
            utils.dynamicSamplingContextToSentryBaggageHeader(dynamicSamplingContext);
        }

        return appGetInitialProps;
      } else {
        return errorWrappedAppGetInitialProps.apply(thisArg, args);
      }
    },
  });
}

/**
 * @deprecated Use `wrapAppGetInitialPropsWithSentry` instead.
 */
const withSentryServerSideAppGetInitialProps = wrapAppGetInitialPropsWithSentry;

exports.withSentryServerSideAppGetInitialProps = withSentryServerSideAppGetInitialProps;
exports.wrapAppGetInitialPropsWithSentry = wrapAppGetInitialPropsWithSentry;
//# sourceMappingURL=wrapAppGetInitialPropsWithSentry.js.map


/***/ }),

/***/ 1148:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const node = __webpack_require__(5529);
const tracing = __webpack_require__(7363);
const isBuild = __webpack_require__(9662);
const wrapperUtils = __webpack_require__(4850);

/**
 * Create a wrapped version of the user's exported `getInitialProps` function in
 * a custom document ("_document.js").
 *
 * @param origDocumentGetInitialProps The user's `getInitialProps` function
 * @param parameterizedRoute The page's parameterized route
 * @returns A wrapped version of the function
 */
function wrapDocumentGetInitialPropsWithSentry(
  origDocumentGetInitialProps,
) {
  return new Proxy(origDocumentGetInitialProps, {
    apply: async (wrappingTarget, thisArg, args) => {
      if (isBuild.isBuild()) {
        return wrappingTarget.apply(thisArg, args);
      }

      const [context] = args;
      const { req, res } = context;

      const errorWrappedGetInitialProps = wrapperUtils.withErrorInstrumentation(wrappingTarget);
      const options = _optionalChain([node.getCurrentHub, 'call', _ => _(), 'access', _2 => _2.getClient, 'call', _3 => _3(), 'optionalAccess', _4 => _4.getOptions, 'call', _5 => _5()]);

      // Generally we can assume that `req` and `res` are always defined on the server:
      // https://nextjs.org/docs/api-reference/data-fetching/get-initial-props#context-object
      // This does not seem to be the case in dev mode. Because we have no clean way of associating the the data fetcher
      // span with each other when there are no req or res objects, we simply do not trace them at all here.
      if (tracing.hasTracingEnabled() && req && res && _optionalChain([options, 'optionalAccess', _6 => _6.instrumenter]) === 'sentry') {
        const tracedGetInitialProps = wrapperUtils.withTracedServerSideDataFetcher(errorWrappedGetInitialProps, req, res, {
          dataFetcherRouteName: '/_document',
          requestedRouteName: context.pathname,
          dataFetchingMethodName: 'getInitialProps',
        });

        return await tracedGetInitialProps.apply(thisArg, args);
      } else {
        return errorWrappedGetInitialProps.apply(thisArg, args);
      }
    },
  });
}

/**
 * @deprecated Use `wrapDocumentGetInitialPropsWithSentry` instead.
 */
const withSentryServerSideDocumentGetInitialProps = wrapDocumentGetInitialPropsWithSentry;

exports.withSentryServerSideDocumentGetInitialProps = withSentryServerSideDocumentGetInitialProps;
exports.wrapDocumentGetInitialPropsWithSentry = wrapDocumentGetInitialPropsWithSentry;
//# sourceMappingURL=wrapDocumentGetInitialPropsWithSentry.js.map


/***/ }),

/***/ 8833:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const node = __webpack_require__(5529);
const tracing = __webpack_require__(7363);
const utils = __webpack_require__(9425);
const isBuild = __webpack_require__(9662);
const wrapperUtils = __webpack_require__(4850);

/**
 * Create a wrapped version of the user's exported `getInitialProps` function in
 * a custom error page ("_error.js").
 *
 * @param origErrorGetInitialProps The user's `getInitialProps` function
 * @param parameterizedRoute The page's parameterized route
 * @returns A wrapped version of the function
 */
function wrapErrorGetInitialPropsWithSentry(
  origErrorGetInitialProps,
) {
  return new Proxy(origErrorGetInitialProps, {
    apply: async (wrappingTarget, thisArg, args) => {
      if (isBuild.isBuild()) {
        return wrappingTarget.apply(thisArg, args);
      }

      const [context] = args;
      const { req, res } = context;

      const errorWrappedGetInitialProps = wrapperUtils.withErrorInstrumentation(wrappingTarget);
      const options = _optionalChain([node.getCurrentHub, 'call', _ => _(), 'access', _2 => _2.getClient, 'call', _3 => _3(), 'optionalAccess', _4 => _4.getOptions, 'call', _5 => _5()]);

      // Generally we can assume that `req` and `res` are always defined on the server:
      // https://nextjs.org/docs/api-reference/data-fetching/get-initial-props#context-object
      // This does not seem to be the case in dev mode. Because we have no clean way of associating the the data fetcher
      // span with each other when there are no req or res objects, we simply do not trace them at all here.
      if (tracing.hasTracingEnabled() && req && res && _optionalChain([options, 'optionalAccess', _6 => _6.instrumenter]) === 'sentry') {
        const tracedGetInitialProps = wrapperUtils.withTracedServerSideDataFetcher(errorWrappedGetInitialProps, req, res, {
          dataFetcherRouteName: '/_error',
          requestedRouteName: context.pathname,
          dataFetchingMethodName: 'getInitialProps',
        });

        const errorGetInitialProps

 = await tracedGetInitialProps.apply(thisArg, args);

        const requestTransaction = wrapperUtils.getTransactionFromRequest(req);
        if (requestTransaction) {
          errorGetInitialProps._sentryTraceData = requestTransaction.toTraceparent();

          const dynamicSamplingContext = requestTransaction.getDynamicSamplingContext();
          errorGetInitialProps._sentryBaggage = utils.dynamicSamplingContextToSentryBaggageHeader(dynamicSamplingContext);
        }

        return errorGetInitialProps;
      } else {
        return errorWrappedGetInitialProps.apply(thisArg, args);
      }
    },
  });
}

/**
 * @deprecated Use `wrapErrorGetInitialPropsWithSentry` instead.
 */
const withSentryServerSideErrorGetInitialProps = wrapErrorGetInitialPropsWithSentry;

exports.withSentryServerSideErrorGetInitialProps = withSentryServerSideErrorGetInitialProps;
exports.wrapErrorGetInitialPropsWithSentry = wrapErrorGetInitialPropsWithSentry;
//# sourceMappingURL=wrapErrorGetInitialPropsWithSentry.js.map


/***/ }),

/***/ 9751:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const node = __webpack_require__(5529);
const tracing = __webpack_require__(7363);
const utils = __webpack_require__(9425);
const isBuild = __webpack_require__(9662);
const wrapperUtils = __webpack_require__(4850);

/**
 * Create a wrapped version of the user's exported `getInitialProps` function
 *
 * @param origGetInitialProps The user's `getInitialProps` function
 * @param parameterizedRoute The page's parameterized route
 * @returns A wrapped version of the function
 */
function wrapGetInitialPropsWithSentry(origGetInitialProps) {
  return new Proxy(origGetInitialProps, {
    apply: async (wrappingTarget, thisArg, args) => {
      if (isBuild.isBuild()) {
        return wrappingTarget.apply(thisArg, args);
      }

      const [context] = args;
      const { req, res } = context;

      const errorWrappedGetInitialProps = wrapperUtils.withErrorInstrumentation(wrappingTarget);
      const options = _optionalChain([node.getCurrentHub, 'call', _ => _(), 'access', _2 => _2.getClient, 'call', _3 => _3(), 'optionalAccess', _4 => _4.getOptions, 'call', _5 => _5()]);

      // Generally we can assume that `req` and `res` are always defined on the server:
      // https://nextjs.org/docs/api-reference/data-fetching/get-initial-props#context-object
      // This does not seem to be the case in dev mode. Because we have no clean way of associating the the data fetcher
      // span with each other when there are no req or res objects, we simply do not trace them at all here.
      if (tracing.hasTracingEnabled() && req && res && _optionalChain([options, 'optionalAccess', _6 => _6.instrumenter]) === 'sentry') {
        const tracedGetInitialProps = wrapperUtils.withTracedServerSideDataFetcher(errorWrappedGetInitialProps, req, res, {
          dataFetcherRouteName: context.pathname,
          requestedRouteName: context.pathname,
          dataFetchingMethodName: 'getInitialProps',
        });

        const initialProps

 = await tracedGetInitialProps.apply(thisArg, args);

        const requestTransaction = wrapperUtils.getTransactionFromRequest(req);
        if (requestTransaction) {
          initialProps._sentryTraceData = requestTransaction.toTraceparent();

          const dynamicSamplingContext = requestTransaction.getDynamicSamplingContext();
          initialProps._sentryBaggage = utils.dynamicSamplingContextToSentryBaggageHeader(dynamicSamplingContext);
        }

        return initialProps;
      } else {
        return errorWrappedGetInitialProps.apply(thisArg, args);
      }
    },
  });
}

/**
 * @deprecated Use `wrapGetInitialPropsWithSentry` instead.
 */
const withSentryServerSideGetInitialProps = wrapGetInitialPropsWithSentry;

exports.withSentryServerSideGetInitialProps = withSentryServerSideGetInitialProps;
exports.wrapGetInitialPropsWithSentry = wrapGetInitialPropsWithSentry;
//# sourceMappingURL=wrapGetInitialPropsWithSentry.js.map


/***/ }),

/***/ 7179:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const node = __webpack_require__(5529);
const tracing = __webpack_require__(7363);
const utils = __webpack_require__(9425);
const isBuild = __webpack_require__(9662);
const wrapperUtils = __webpack_require__(4850);

/**
 * Create a wrapped version of the user's exported `getServerSideProps` function
 *
 * @param origGetServerSideProps The user's `getServerSideProps` function
 * @param parameterizedRoute The page's parameterized route
 * @returns A wrapped version of the function
 */
function wrapGetServerSidePropsWithSentry(
  origGetServerSideProps,
  parameterizedRoute,
) {
  return new Proxy(origGetServerSideProps, {
    apply: async (wrappingTarget, thisArg, args) => {
      if (isBuild.isBuild()) {
        return wrappingTarget.apply(thisArg, args);
      }

      const [context] = args;
      const { req, res } = context;

      const errorWrappedGetServerSideProps = wrapperUtils.withErrorInstrumentation(wrappingTarget);
      const options = _optionalChain([node.getCurrentHub, 'call', _ => _(), 'access', _2 => _2.getClient, 'call', _3 => _3(), 'optionalAccess', _4 => _4.getOptions, 'call', _5 => _5()]);

      if (tracing.hasTracingEnabled() && _optionalChain([options, 'optionalAccess', _6 => _6.instrumenter]) === 'sentry') {
        const tracedGetServerSideProps = wrapperUtils.withTracedServerSideDataFetcher(errorWrappedGetServerSideProps, req, res, {
          dataFetcherRouteName: parameterizedRoute,
          requestedRouteName: parameterizedRoute,
          dataFetchingMethodName: 'getServerSideProps',
        });

        const serverSideProps = await (tracedGetServerSideProps.apply(thisArg, args)

);

        if ('props' in serverSideProps) {
          const requestTransaction = wrapperUtils.getTransactionFromRequest(req);
          if (requestTransaction) {
            serverSideProps.props._sentryTraceData = requestTransaction.toTraceparent();

            const dynamicSamplingContext = requestTransaction.getDynamicSamplingContext();
            serverSideProps.props._sentryBaggage = utils.dynamicSamplingContextToSentryBaggageHeader(dynamicSamplingContext);
          }
        }

        return serverSideProps;
      } else {
        return errorWrappedGetServerSideProps.apply(thisArg, args);
      }
    },
  });
}

/**
 * @deprecated Use `withSentryGetServerSideProps` instead.
 */
const withSentryGetServerSideProps = wrapGetServerSidePropsWithSentry;

exports.withSentryGetServerSideProps = withSentryGetServerSideProps;
exports.wrapGetServerSidePropsWithSentry = wrapGetServerSidePropsWithSentry;
//# sourceMappingURL=wrapGetServerSidePropsWithSentry.js.map


/***/ }),

/***/ 4675:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const node = __webpack_require__(5529);
const tracing = __webpack_require__(7363);
const isBuild = __webpack_require__(9662);
const wrapperUtils = __webpack_require__(4850);

/**
 * Create a wrapped version of the user's exported `getStaticProps` function
 *
 * @param origGetStaticProps The user's `getStaticProps` function
 * @param parameterizedRoute The page's parameterized route
 * @returns A wrapped version of the function
 */
function wrapGetStaticPropsWithSentry(
  origGetStaticPropsa,
  parameterizedRoute,
) {
  return new Proxy(origGetStaticPropsa, {
    apply: async (wrappingTarget, thisArg, args) => {
      if (isBuild.isBuild()) {
        return wrappingTarget.apply(thisArg, args);
      }

      const errorWrappedGetStaticProps = wrapperUtils.withErrorInstrumentation(wrappingTarget);
      const options = _optionalChain([node.getCurrentHub, 'call', _ => _(), 'access', _2 => _2.getClient, 'call', _3 => _3(), 'optionalAccess', _4 => _4.getOptions, 'call', _5 => _5()]);

      if (tracing.hasTracingEnabled() && _optionalChain([options, 'optionalAccess', _6 => _6.instrumenter]) === 'sentry') {
        return wrapperUtils.callDataFetcherTraced(errorWrappedGetStaticProps, args, {
          parameterizedRoute,
          dataFetchingMethodName: 'getStaticProps',
        });
      }

      return errorWrappedGetStaticProps.apply(thisArg, args);
    },
  });
}

/**
 * @deprecated Use `wrapGetStaticPropsWithSentry` instead.
 */
const withSentryGetStaticProps = wrapGetStaticPropsWithSentry;

exports.withSentryGetStaticProps = withSentryGetStaticProps;
exports.wrapGetStaticPropsWithSentry = wrapGetStaticPropsWithSentry;
//# sourceMappingURL=wrapGetStaticPropsWithSentry.js.map


/***/ }),

/***/ 4911:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const os = __webpack_require__(2037);
const util = __webpack_require__(3837);
const eventbuilder = __webpack_require__(9185);

/**
 * The Sentry Node SDK Client.
 *
 * @see NodeClientOptions for documentation on configuration options.
 * @see SentryClient for usage documentation.
 */
class NodeClient extends core.BaseClient {

  /**
   * Creates a new Node SDK instance.
   * @param options Configuration options for this SDK.
   */
   constructor(options) {
    options._metadata = options._metadata || {};
    options._metadata.sdk = options._metadata.sdk || {
      name: 'sentry.javascript.node',
      packages: [
        {
          name: 'npm:@sentry/node',
          version: core.SDK_VERSION,
        },
      ],
      version: core.SDK_VERSION,
    };

    // Until node supports global TextEncoder in all versions we support, we are forced to pass it from util
    options.transportOptions = {
      textEncoder: new util.TextEncoder(),
      ...options.transportOptions,
    };

    super(options);
  }

  /**
   * @inheritDoc
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
   captureException(exception, hint, scope) {
    // Check if the flag `autoSessionTracking` is enabled, and if `_sessionFlusher` exists because it is initialised only
    // when the `requestHandler` middleware is used, and hence the expectation is to have SessionAggregates payload
    // sent to the Server only when the `requestHandler` middleware is used
    if (this._options.autoSessionTracking && this._sessionFlusher && scope) {
      const requestSession = scope.getRequestSession();

      // Necessary checks to ensure this is code block is executed only within a request
      // Should override the status only if `requestSession.status` is `Ok`, which is its initial stage
      if (requestSession && requestSession.status === 'ok') {
        requestSession.status = 'errored';
      }
    }

    return super.captureException(exception, hint, scope);
  }

  /**
   * @inheritDoc
   */
   captureEvent(event, hint, scope) {
    // Check if the flag `autoSessionTracking` is enabled, and if `_sessionFlusher` exists because it is initialised only
    // when the `requestHandler` middleware is used, and hence the expectation is to have SessionAggregates payload
    // sent to the Server only when the `requestHandler` middleware is used
    if (this._options.autoSessionTracking && this._sessionFlusher && scope) {
      const eventType = event.type || 'exception';
      const isException =
        eventType === 'exception' && event.exception && event.exception.values && event.exception.values.length > 0;

      // If the event is of type Exception, then a request session should be captured
      if (isException) {
        const requestSession = scope.getRequestSession();

        // Ensure that this is happening within the bounds of a request, and make sure not to override
        // Session Status if Errored / Crashed
        if (requestSession && requestSession.status === 'ok') {
          requestSession.status = 'errored';
        }
      }
    }

    return super.captureEvent(event, hint, scope);
  }

  /**
   *
   * @inheritdoc
   */
   close(timeout) {
    _optionalChain([this, 'access', _ => _._sessionFlusher, 'optionalAccess', _2 => _2.close, 'call', _3 => _3()]);
    return super.close(timeout);
  }

  /** Method that initialises an instance of SessionFlusher on Client */
   initSessionFlusher() {
    const { release, environment } = this._options;
    if (!release) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('Cannot initialise an instance of SessionFlusher if no release is provided!');
    } else {
      this._sessionFlusher = new core.SessionFlusher(this, {
        release,
        environment,
      });
    }
  }

  /**
   * @inheritDoc
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
   eventFromException(exception, hint) {
    return utils.resolvedSyncPromise(eventbuilder.eventFromUnknownInput(this._options.stackParser, exception, hint));
  }

  /**
   * @inheritDoc
   */
   eventFromMessage(
    message,
    // eslint-disable-next-line deprecation/deprecation
    level = 'info',
    hint,
  ) {
    return utils.resolvedSyncPromise(
      eventbuilder.eventFromMessage(this._options.stackParser, message, level, hint, this._options.attachStacktrace),
    );
  }

  /**
   * @inheritDoc
   */
   _prepareEvent(event, hint, scope) {
    event.platform = event.platform || 'node';
    event.contexts = {
      ...event.contexts,
      runtime: _optionalChain([event, 'access', _4 => _4.contexts, 'optionalAccess', _5 => _5.runtime]) || {
        name: 'node',
        version: global.process.version,
      },
    };
    event.server_name =
      event.server_name || this.getOptions().serverName || global.process.env.SENTRY_NAME || os.hostname();
    return super._prepareEvent(event, hint, scope);
  }

  /**
   * Method responsible for capturing/ending a request session by calling `incrementSessionStatusCount` to increment
   * appropriate session aggregates bucket
   */
   _captureRequestSession() {
    if (!this._sessionFlusher) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('Discarded request mode session because autoSessionTracking option was disabled');
    } else {
      this._sessionFlusher.incrementSessionStatusCount();
    }
  }
}

exports.NodeClient = NodeClient;
//# sourceMappingURL=client.js.map


/***/ }),

/***/ 9185:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);

/**
 * Extracts stack frames from the error.stack string
 */
function parseStackFrames(stackParser, error) {
  return stackParser(error.stack || '', 1);
}

/**
 * Extracts stack frames from the error and builds a Sentry Exception
 */
function exceptionFromError(stackParser, error) {
  const exception = {
    type: error.name || error.constructor.name,
    value: error.message,
  };

  const frames = parseStackFrames(stackParser, error);
  if (frames.length) {
    exception.stacktrace = { frames };
  }

  return exception;
}

/**
 * Builds and Event from a Exception
 * @hidden
 */
function eventFromUnknownInput(stackParser, exception, hint) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ex = exception;
  const providedMechanism =
    hint && hint.data && (hint.data ).mechanism;
  const mechanism = providedMechanism || {
    handled: true,
    type: 'generic',
  };

  if (!utils.isError(exception)) {
    if (utils.isPlainObject(exception)) {
      // This will allow us to group events based on top-level keys
      // which is much better than creating new group when any key/value change
      const message = `Non-Error exception captured with keys: ${utils.extractExceptionKeysForMessage(exception)}`;

      const hub = core.getCurrentHub();
      const client = hub.getClient();
      const normalizeDepth = client && client.getOptions().normalizeDepth;
      hub.configureScope(scope => {
        scope.setExtra('__serialized__', utils.normalizeToSize(exception, normalizeDepth));
      });

      ex = (hint && hint.syntheticException) || new Error(message);
      (ex ).message = message;
    } else {
      // This handles when someone does: `throw "something awesome";`
      // We use synthesized Error here so we can extract a (rough) stack trace.
      ex = (hint && hint.syntheticException) || new Error(exception );
      (ex ).message = exception ;
    }
    mechanism.synthetic = true;
  }

  const event = {
    exception: {
      values: [exceptionFromError(stackParser, ex )],
    },
  };

  utils.addExceptionTypeValue(event, undefined, undefined);
  utils.addExceptionMechanism(event, mechanism);

  return {
    ...event,
    event_id: hint && hint.event_id,
  };
}

/**
 * Builds and Event from a Message
 * @hidden
 */
function eventFromMessage(
  stackParser,
  message,
  // eslint-disable-next-line deprecation/deprecation
  level = 'info',
  hint,
  attachStacktrace,
) {
  const event = {
    event_id: hint && hint.event_id,
    level,
    message,
  };

  if (attachStacktrace && hint && hint.syntheticException) {
    const frames = parseStackFrames(stackParser, hint.syntheticException);
    if (frames.length) {
      event.exception = {
        values: [
          {
            value: message,
            stacktrace: { frames },
          },
        ],
      };
    }
  }

  return event;
}

exports.eventFromMessage = eventFromMessage;
exports.eventFromUnknownInput = eventFromUnknownInput;
exports.exceptionFromError = exceptionFromError;
exports.parseStackFrames = parseStackFrames;
//# sourceMappingURL=eventbuilder.js.map


/***/ }),

/***/ 4205:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const domain = __webpack_require__(3639);
const requestdata = __webpack_require__(3098);
const sdk = __webpack_require__(2339);
const requestDataDeprecated = __webpack_require__(404);

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Express-compatible tracing handler.
 * @see Exposed as `Handlers.tracingHandler`
 */
function tracingHandler()

 {
  return function sentryTracingMiddleware(
    req,
    res,
    next,
  ) {
    const hub = core.getCurrentHub();
    const options = _optionalChain([hub, 'access', _ => _.getClient, 'call', _2 => _2(), 'optionalAccess', _3 => _3.getOptions, 'call', _4 => _4()]);

    if (
      !options ||
      options.instrumenter !== 'sentry' ||
      _optionalChain([req, 'access', _5 => _5.method, 'optionalAccess', _6 => _6.toUpperCase, 'call', _7 => _7()]) === 'OPTIONS' ||
      _optionalChain([req, 'access', _8 => _8.method, 'optionalAccess', _9 => _9.toUpperCase, 'call', _10 => _10()]) === 'HEAD'
    ) {
      return next();
    }

    // TODO: This is the `hasTracingEnabled` check, but we're doing it manually since `@sentry/tracing` isn't a
    // dependency of `@sentry/node`. Long term, that function should probably move to `@sentry/hub.
    if (!('tracesSampleRate' in options) && !('tracesSampler' in options)) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
        utils.logger.warn(
          'Sentry `tracingHandler` is being used, but tracing is disabled. Please enable tracing by setting ' +
            'either `tracesSampleRate` or `tracesSampler` in your `Sentry.init()` options.',
        );
      return next();
    }

    // If there is a trace header set, we extract the data from it (parentSpanId, traceId, and sampling decision)
    const traceparentData =
      req.headers && utils.isString(req.headers['sentry-trace']) && utils.extractTraceparentData(req.headers['sentry-trace']);
    const incomingBaggageHeaders = _optionalChain([req, 'access', _11 => _11.headers, 'optionalAccess', _12 => _12.baggage]);
    const dynamicSamplingContext = utils.baggageHeaderToDynamicSamplingContext(incomingBaggageHeaders);

    const [name, source] = utils.extractPathForTransaction(req, { path: true, method: true });
    const transaction = core.startTransaction(
      {
        name,
        op: 'http.server',
        ...traceparentData,
        metadata: {
          dynamicSamplingContext: traceparentData && !dynamicSamplingContext ? {} : dynamicSamplingContext,
          // The request should already have been stored in `scope.sdkProcessingMetadata` (which will become
          // `event.sdkProcessingMetadata` the same way the metadata here will) by `sentryRequestMiddleware`, but on the
          // off chance someone is using `sentryTracingMiddleware` without `sentryRequestMiddleware`, it doesn't hurt to
          // be sure
          request: req,
          source,
        },
      },
      // extra context passed to the tracesSampler
      { request: requestdata.extractRequestData(req) },
    );

    // We put the transaction on the scope so users can attach children to it
    hub.configureScope(scope => {
      scope.setSpan(transaction);
    });

    // We also set __sentry_transaction on the response so people can grab the transaction there to add
    // spans to it later.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (res ).__sentry_transaction = transaction;

    res.once('finish', () => {
      // Push `transaction.finish` to the next event loop so open spans have a chance to finish before the transaction
      // closes
      setImmediate(() => {
        utils.addRequestDataToTransaction(transaction, req);
        transaction.setHttpStatus(res.statusCode);
        transaction.finish();
      });
    });

    next();
  };
}

/**
 * Backwards compatibility shim which can be removed in v8. Forces the given options to follow the
 * `AddRequestDataToEventOptions` interface.
 *
 * TODO (v8): Get rid of this, and stop passing `requestDataOptionsFromExpressHandler` to `setSDKProcessingMetadata`.
 */
function convertReqHandlerOptsToAddReqDataOpts(
  reqHandlerOptions = {},
) {
  let addRequestDataOptions;

  if ('include' in reqHandlerOptions) {
    addRequestDataOptions = { include: reqHandlerOptions.include };
  } else {
    // eslint-disable-next-line deprecation/deprecation
    const { ip, request, transaction, user } = reqHandlerOptions ;

    if (ip || request || transaction || user) {
      addRequestDataOptions = { include: utils.dropUndefinedKeys({ ip, request, transaction, user }) };
    }
  }

  return addRequestDataOptions;
}

/**
 * Express compatible request handler.
 * @see Exposed as `Handlers.requestHandler`
 */
function requestHandler(
  options,
) {
  // TODO (v8): Get rid of this
  const requestDataOptions = convertReqHandlerOptsToAddReqDataOpts(options);

  const currentHub = core.getCurrentHub();
  const client = currentHub.getClient();
  // Initialise an instance of SessionFlusher on the client when `autoSessionTracking` is enabled and the
  // `requestHandler` middleware is used indicating that we are running in SessionAggregates mode
  if (client && sdk.isAutoSessionTrackingEnabled(client)) {
    client.initSessionFlusher();

    // If Scope contains a Single mode Session, it is removed in favor of using Session Aggregates mode
    const scope = currentHub.getScope();
    if (scope && scope.getSession()) {
      scope.setSession();
    }
  }

  return function sentryRequestMiddleware(
    req,
    res,
    next,
  ) {
    if (options && options.flushTimeout && options.flushTimeout > 0) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const _end = res.end;
      res.end = function (chunk, encoding, cb) {
        void sdk.flush(options.flushTimeout)
          .then(() => {
            _end.call(this, chunk, encoding, cb);
          })
          .then(null, e => {
            (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error(e);
            _end.call(this, chunk, encoding, cb);
          });
      };
    }
    const local = domain.create();
    local.add(req);
    local.add(res);

    local.run(() => {
      const currentHub = core.getCurrentHub();

      currentHub.configureScope(scope => {
        scope.setSDKProcessingMetadata({
          request: req,
          // TODO (v8): Stop passing this
          requestDataOptionsFromExpressHandler: requestDataOptions,
        });

        const client = currentHub.getClient();
        if (sdk.isAutoSessionTrackingEnabled(client)) {
          const scope = currentHub.getScope();
          if (scope) {
            // Set `status` of `RequestSession` to Ok, at the beginning of the request
            scope.setRequestSession({ status: 'ok' });
          }
        }
      });

      res.once('finish', () => {
        const client = currentHub.getClient();
        if (sdk.isAutoSessionTrackingEnabled(client)) {
          setImmediate(() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (client && (client )._captureRequestSession) {
              // Calling _captureRequestSession to capture request session at the end of the request by incrementing
              // the correct SessionAggregates bucket i.e. crashed, errored or exited
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              (client )._captureRequestSession();
            }
          });
        }
      });
      next();
    });
  };
}

/** JSDoc */

/** JSDoc */
function getStatusCodeFromResponse(error) {
  const statusCode = error.status || error.statusCode || error.status_code || (error.output && error.output.statusCode);
  return statusCode ? parseInt(statusCode , 10) : 500;
}

/** Returns true if response code is internal server error */
function defaultShouldHandleError(error) {
  const status = getStatusCodeFromResponse(error);
  return status >= 500;
}

/**
 * Express compatible error handler.
 * @see Exposed as `Handlers.errorHandler`
 */
function errorHandler(options

)

 {
  return function sentryErrorMiddleware(
    error,
    _req,
    res,
    next,
  ) {
    const shouldHandleError = (options && options.shouldHandleError) || defaultShouldHandleError;

    if (shouldHandleError(error)) {
      core.withScope(_scope => {
        // The request should already have been stored in `scope.sdkProcessingMetadata` by `sentryRequestMiddleware`,
        // but on the off chance someone is using `sentryErrorMiddleware` without `sentryRequestMiddleware`, it doesn't
        // hurt to be sure
        _scope.setSDKProcessingMetadata({ request: _req });

        // For some reason we need to set the transaction on the scope again
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const transaction = (res ).__sentry_transaction ;
        if (transaction && _scope.getSpan() === undefined) {
          _scope.setSpan(transaction);
        }

        const client = core.getCurrentHub().getClient();
        if (client && sdk.isAutoSessionTrackingEnabled(client)) {
          // Check if the `SessionFlusher` is instantiated on the client to go into this branch that marks the
          // `requestSession.status` as `Crashed`, and this check is necessary because the `SessionFlusher` is only
          // instantiated when the the`requestHandler` middleware is initialised, which indicates that we should be
          // running in SessionAggregates mode
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const isSessionAggregatesMode = (client )._sessionFlusher !== undefined;
          if (isSessionAggregatesMode) {
            const requestSession = _scope.getRequestSession();
            // If an error bubbles to the `errorHandler`, then this is an unhandled error, and should be reported as a
            // Crashed session. The `_requestSession.status` is checked to ensure that this error is happening within
            // the bounds of a request, and if so the status is updated
            if (requestSession && requestSession.status !== undefined) {
              requestSession.status = 'crashed';
            }
          }
        }

        const eventId = core.captureException(error);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (res ).sentry = eventId;
        next(error);
      });

      return;
    }

    next(error);
  };
}

exports.extractRequestData = requestDataDeprecated.extractRequestData;
exports.parseRequest = requestDataDeprecated.parseRequest;
exports.errorHandler = errorHandler;
exports.requestHandler = requestHandler;
exports.tracingHandler = tracingHandler;
//# sourceMappingURL=handlers.js.map


/***/ }),

/***/ 5529:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const client = __webpack_require__(4911);
const http = __webpack_require__(2356);
const sdk = __webpack_require__(2339);
const requestdata = __webpack_require__(3098);
const utils = __webpack_require__(8797);
const domain = __webpack_require__(3639);
const handlers = __webpack_require__(4205);
const index = __webpack_require__(2287);

const INTEGRATIONS = {
  ...core.Integrations,
  ...index,
};

// We need to patch domain on the global __SENTRY__ object to make it work for node in cross-platform packages like
// @sentry/core. If we don't do this, browser bundlers will have troubles resolving `require('domain')`.
const carrier = core.getMainCarrier();
if (carrier.__SENTRY__) {
  carrier.__SENTRY__.extensions = carrier.__SENTRY__.extensions || {};
  carrier.__SENTRY__.extensions.domain = carrier.__SENTRY__.extensions.domain || domain;
}

exports.Hub = core.Hub;
exports.SDK_VERSION = core.SDK_VERSION;
exports.Scope = core.Scope;
exports.addBreadcrumb = core.addBreadcrumb;
exports.addGlobalEventProcessor = core.addGlobalEventProcessor;
exports.captureEvent = core.captureEvent;
exports.captureException = core.captureException;
exports.captureMessage = core.captureMessage;
exports.configureScope = core.configureScope;
exports.createTransport = core.createTransport;
exports.getCurrentHub = core.getCurrentHub;
exports.getHubFromCarrier = core.getHubFromCarrier;
exports.makeMain = core.makeMain;
exports.setContext = core.setContext;
exports.setExtra = core.setExtra;
exports.setExtras = core.setExtras;
exports.setTag = core.setTag;
exports.setTags = core.setTags;
exports.setUser = core.setUser;
exports.startTransaction = core.startTransaction;
exports.withScope = core.withScope;
exports.NodeClient = client.NodeClient;
exports.makeNodeTransport = http.makeNodeTransport;
exports.close = sdk.close;
exports.defaultIntegrations = sdk.defaultIntegrations;
exports.defaultStackParser = sdk.defaultStackParser;
exports.flush = sdk.flush;
exports.getSentryRelease = sdk.getSentryRelease;
exports.init = sdk.init;
exports.lastEventId = sdk.lastEventId;
exports.DEFAULT_USER_INCLUDES = requestdata.DEFAULT_USER_INCLUDES;
exports.addRequestDataToEvent = requestdata.addRequestDataToEvent;
exports.extractRequestData = requestdata.extractRequestData;
exports.deepReadDirSync = utils.deepReadDirSync;
exports.Handlers = handlers;
exports.Integrations = INTEGRATIONS;
//# sourceMappingURL=index.js.map


/***/ }),

/***/ 8754:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const util = __webpack_require__(3837);

/** Console module integration */
class Console  {constructor() { Console.prototype.__init.call(this); }
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Console';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Console.id;}

  /**
   * @inheritDoc
   */
   setupOnce() {
    for (const level of ['debug', 'info', 'warn', 'error', 'log']) {
      utils.fill(console, level, createConsoleWrapper(level));
    }
  }
} Console.__initStatic();

/**
 * Wrapper function that'll be used for every console level
 */
function createConsoleWrapper(level) {
  return function consoleWrapper(originalConsoleMethod) {
    const sentryLevel = utils.severityLevelFromString(level);

    /* eslint-disable prefer-rest-params */
    return function () {
      if (core.getCurrentHub().getIntegration(Console)) {
        core.getCurrentHub().addBreadcrumb(
          {
            category: 'console',
            level: sentryLevel,
            message: util.format.apply(undefined, arguments),
          },
          {
            input: [...arguments],
            level,
          },
        );
      }

      originalConsoleMethod.apply(this, arguments);
    };
    /* eslint-enable prefer-rest-params */
  };
}

exports.Console = Console;
//# sourceMappingURL=console.js.map


/***/ }),

/***/ 9574:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const child_process = __webpack_require__(2081);
const fs = __webpack_require__(7147);
const os = __webpack_require__(2037);
const path = __webpack_require__(1017);
const util = __webpack_require__(3837);

// TODO: Required until we drop support for Node v8
const readFileAsync = util.promisify(fs.readFile);
const readDirAsync = util.promisify(fs.readdir);

/** Add node modules / packages to the event */
class Context  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Context';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Context.id;}

  /**
   * Caches context so it's only evaluated once
   */

   constructor(  _options = { app: true, os: true, device: true, culture: true }) {this._options = _options;Context.prototype.__init.call(this);
    //
  }

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor) {
    addGlobalEventProcessor(event => this.addContext(event));
  }

  /** Processes an event and adds context */
   async addContext(event) {
    if (this._cachedContext === undefined) {
      this._cachedContext = this._getContexts();
    }

    const updatedContext = this._updateContext(await this._cachedContext);

    event.contexts = {
      ...event.contexts,
      app: { ...updatedContext.app, ..._optionalChain([event, 'access', _ => _.contexts, 'optionalAccess', _2 => _2.app]) },
      os: { ...updatedContext.os, ..._optionalChain([event, 'access', _3 => _3.contexts, 'optionalAccess', _4 => _4.os]) },
      device: { ...updatedContext.device, ..._optionalChain([event, 'access', _5 => _5.contexts, 'optionalAccess', _6 => _6.device]) },
      culture: { ...updatedContext.culture, ..._optionalChain([event, 'access', _7 => _7.contexts, 'optionalAccess', _8 => _8.culture]) },
    };

    return event;
  }

  /**
   * Updates the context with dynamic values that can change
   */
   _updateContext(contexts) {
    // Only update properties if they exist
    if (_optionalChain([contexts, 'optionalAccess', _9 => _9.app, 'optionalAccess', _10 => _10.app_memory])) {
      contexts.app.app_memory = process.memoryUsage().rss;
    }

    if (_optionalChain([contexts, 'optionalAccess', _11 => _11.device, 'optionalAccess', _12 => _12.free_memory])) {
      contexts.device.free_memory = os.freemem();
    }

    return contexts;
  }

  /**
   * Gets the contexts for the current environment
   */
   async _getContexts() {
    const contexts = {};

    if (this._options.os) {
      contexts.os = await getOsContext();
    }

    if (this._options.app) {
      contexts.app = getAppContext();
    }

    if (this._options.device) {
      contexts.device = getDeviceContext(this._options.device);
    }

    if (this._options.culture) {
      const culture = getCultureContext();

      if (culture) {
        contexts.culture = culture;
      }
    }

    return contexts;
  }
}Context.__initStatic();

/**
 * Returns the operating system context.
 *
 * Based on the current platform, this uses a different strategy to provide the
 * most accurate OS information. Since this might involve spawning subprocesses
 * or accessing the file system, this should only be executed lazily and cached.
 *
 *  - On macOS (Darwin), this will execute the `sw_vers` utility. The context
 *    has a `name`, `version`, `build` and `kernel_version` set.
 *  - On Linux, this will try to load a distribution release from `/etc` and set
 *    the `name`, `version` and `kernel_version` fields.
 *  - On all other platforms, only a `name` and `version` will be returned. Note
 *    that `version` might actually be the kernel version.
 */
async function getOsContext() {
  const platformId = os.platform();
  switch (platformId) {
    case 'darwin':
      return getDarwinInfo();
    case 'linux':
      return getLinuxInfo();
    default:
      return {
        name: PLATFORM_NAMES[platformId] || platformId,
        version: os.release(),
      };
  }
}

function getCultureContext() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    if (typeof (process.versions ).icu !== 'string') {
      // Node was built without ICU support
      return;
    }

    // Check that node was built with full Intl support. Its possible it was built without support for non-English
    // locales which will make resolvedOptions inaccurate
    //
    // https://nodejs.org/api/intl.html#detecting-internationalization-support
    const january = new Date(9e8);
    const spanish = new Intl.DateTimeFormat('es', { month: 'long' });
    if (spanish.format(january) === 'enero') {
      const options = Intl.DateTimeFormat().resolvedOptions();

      return {
        locale: options.locale,
        timezone: options.timeZone,
      };
    }
  } catch (err) {
    //
  }

  return;
}

function getAppContext() {
  const app_memory = process.memoryUsage().rss;
  const app_start_time = new Date(Date.now() - process.uptime() * 1000).toISOString();

  return { app_start_time, app_memory };
}

/**
 * Gets device information from os
 */
function getDeviceContext(deviceOpt) {
  const device = {};

  // os.uptime or its return value seem to be undefined in certain environments (e.g. Azure functions).
  // Hence, we only set boot time, if we get a valid uptime value.
  // @see https://github.com/getsentry/sentry-javascript/issues/5856
  const uptime = os.uptime && os.uptime();
  if (typeof uptime === 'number') {
    device.boot_time = new Date(Date.now() - uptime * 1000).toISOString();
  }

  device.arch = os.arch();

  if (deviceOpt === true || deviceOpt.memory) {
    device.memory_size = os.totalmem();
    device.free_memory = os.freemem();
  }

  if (deviceOpt === true || deviceOpt.cpu) {
    const cpuInfo = os.cpus();
    if (cpuInfo && cpuInfo.length) {
      const firstCpu = cpuInfo[0];

      device.processor_count = cpuInfo.length;
      device.cpu_description = firstCpu.model;
      device.processor_frequency = firstCpu.speed;
    }
  }

  return device;
}

/** Mapping of Node's platform names to actual OS names. */
const PLATFORM_NAMES = {
  aix: 'IBM AIX',
  freebsd: 'FreeBSD',
  openbsd: 'OpenBSD',
  sunos: 'SunOS',
  win32: 'Windows',
};

/** Linux version file to check for a distribution. */

/** Mapping of linux release files located in /etc to distributions. */
const LINUX_DISTROS = [
  { name: 'fedora-release', distros: ['Fedora'] },
  { name: 'redhat-release', distros: ['Red Hat Linux', 'Centos'] },
  { name: 'redhat_version', distros: ['Red Hat Linux'] },
  { name: 'SuSE-release', distros: ['SUSE Linux'] },
  { name: 'lsb-release', distros: ['Ubuntu Linux', 'Arch Linux'] },
  { name: 'debian_version', distros: ['Debian'] },
  { name: 'debian_release', distros: ['Debian'] },
  { name: 'arch-release', distros: ['Arch Linux'] },
  { name: 'gentoo-release', distros: ['Gentoo Linux'] },
  { name: 'novell-release', distros: ['SUSE Linux'] },
  { name: 'alpine-release', distros: ['Alpine Linux'] },
];

/** Functions to extract the OS version from Linux release files. */
const LINUX_VERSIONS

 = {
  alpine: content => content,
  arch: content => matchFirst(/distrib_release=(.*)/, content),
  centos: content => matchFirst(/release ([^ ]+)/, content),
  debian: content => content,
  fedora: content => matchFirst(/release (..)/, content),
  mint: content => matchFirst(/distrib_release=(.*)/, content),
  red: content => matchFirst(/release ([^ ]+)/, content),
  suse: content => matchFirst(/VERSION = (.*)\n/, content),
  ubuntu: content => matchFirst(/distrib_release=(.*)/, content),
};

/**
 * Executes a regular expression with one capture group.
 *
 * @param regex A regular expression to execute.
 * @param text Content to execute the RegEx on.
 * @returns The captured string if matched; otherwise undefined.
 */
function matchFirst(regex, text) {
  const match = regex.exec(text);
  return match ? match[1] : undefined;
}

/** Loads the macOS operating system context. */
async function getDarwinInfo() {
  // Default values that will be used in case no operating system information
  // can be loaded. The default version is computed via heuristics from the
  // kernel version, but the build ID is missing.
  const darwinInfo = {
    kernel_version: os.release(),
    name: 'Mac OS X',
    version: `10.${Number(os.release().split('.')[0]) - 4}`,
  };

  try {
    // We try to load the actual macOS version by executing the `sw_vers` tool.
    // This tool should be available on every standard macOS installation. In
    // case this fails, we stick with the values computed above.

    const output = await new Promise((resolve, reject) => {
      child_process.execFile('/usr/bin/sw_vers', (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });

    darwinInfo.name = matchFirst(/^ProductName:\s+(.*)$/m, output);
    darwinInfo.version = matchFirst(/^ProductVersion:\s+(.*)$/m, output);
    darwinInfo.build = matchFirst(/^BuildVersion:\s+(.*)$/m, output);
  } catch (e) {
    // ignore
  }

  return darwinInfo;
}

/** Returns a distribution identifier to look up version callbacks. */
function getLinuxDistroId(name) {
  return name.split(' ')[0].toLowerCase();
}

/** Loads the Linux operating system context. */
async function getLinuxInfo() {
  // By default, we cannot assume anything about the distribution or Linux
  // version. `os.release()` returns the kernel version and we assume a generic
  // "Linux" name, which will be replaced down below.
  const linuxInfo = {
    kernel_version: os.release(),
    name: 'Linux',
  };

  try {
    // We start guessing the distribution by listing files in the /etc
    // directory. This is were most Linux distributions (except Knoppix) store
    // release files with certain distribution-dependent meta data. We search
    // for exactly one known file defined in `LINUX_DISTROS` and exit if none
    // are found. In case there are more than one file, we just stick with the
    // first one.
    const etcFiles = await readDirAsync('/etc');
    const distroFile = LINUX_DISTROS.find(file => etcFiles.includes(file.name));
    if (!distroFile) {
      return linuxInfo;
    }

    // Once that file is known, load its contents. To make searching in those
    // files easier, we lowercase the file contents. Since these files are
    // usually quite small, this should not allocate too much memory and we only
    // hold on to it for a very short amount of time.
    const distroPath = path.join('/etc', distroFile.name);
    const contents = ((await readFileAsync(distroPath, { encoding: 'utf-8' })) ).toLowerCase();

    // Some Linux distributions store their release information in the same file
    // (e.g. RHEL and Centos). In those cases, we scan the file for an
    // identifier, that basically consists of the first word of the linux
    // distribution name (e.g. "red" for Red Hat). In case there is no match, we
    // just assume the first distribution in our list.
    const { distros } = distroFile;
    linuxInfo.name = distros.find(d => contents.indexOf(getLinuxDistroId(d)) >= 0) || distros[0];

    // Based on the found distribution, we can now compute the actual version
    // number. This is different for every distribution, so several strategies
    // are computed in `LINUX_VERSIONS`.
    const id = getLinuxDistroId(linuxInfo.name);
    linuxInfo.version = LINUX_VERSIONS[id](contents);
  } catch (e) {
    // ignore
  }

  return linuxInfo;
}

exports.Context = Context;
exports.getDeviceContext = getDeviceContext;
exports.readDirAsync = readDirAsync;
exports.readFileAsync = readFileAsync;
//# sourceMappingURL=context.js.map


/***/ }),

/***/ 7961:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const fs = __webpack_require__(7147);
const lru_map = __webpack_require__(4218);

const FILE_CONTENT_CACHE = new lru_map.LRUMap(100);
const DEFAULT_LINES_OF_CONTEXT = 7;

// TODO: Replace with promisify when minimum supported node >= v8
function readTextFileAsync(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

/** Add node modules / packages to the event */
class ContextLines  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'ContextLines';}

  /**
   * @inheritDoc
   */
   __init() {this.name = ContextLines.id;}

   constructor(  _options = {}) {this._options = _options;ContextLines.prototype.__init.call(this);}

  /** Get's the number of context lines to add */
   get _contextLines() {
    return this._options.frameContextLines !== undefined ? this._options.frameContextLines : DEFAULT_LINES_OF_CONTEXT;
  }

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor) {
    addGlobalEventProcessor(event => this.addSourceContext(event));
  }

  /** Processes an event and adds context lines */
   async addSourceContext(event) {
    if (this._contextLines > 0 && _optionalChain([event, 'access', _2 => _2.exception, 'optionalAccess', _3 => _3.values])) {
      for (const exception of event.exception.values) {
        if (_optionalChain([exception, 'access', _4 => _4.stacktrace, 'optionalAccess', _5 => _5.frames])) {
          await this.addSourceContextToFrames(exception.stacktrace.frames);
        }
      }
    }

    return event;
  }

  /** Adds context lines to frames */
   async addSourceContextToFrames(frames) {
    const contextLines = this._contextLines;

    for (const frame of frames) {
      // Only add context if we have a filename and it hasn't already been added
      if (frame.filename && frame.context_line === undefined) {
        const sourceFile = await _readSourceFile(frame.filename);

        if (sourceFile) {
          try {
            const lines = sourceFile.split('\n');
            utils.addContextToFrame(lines, frame, contextLines);
          } catch (e) {
            // anomaly, being defensive in case
            // unlikely to ever happen in practice but can definitely happen in theory
          }
        }
      }
    }
  }
}ContextLines.__initStatic();

/**
 * Reads file contents and caches them in a global LRU cache.
 *
 * @param filename filepath to read content from.
 */
async function _readSourceFile(filename) {
  const cachedFile = FILE_CONTENT_CACHE.get(filename);
  // We have a cache hit
  if (cachedFile !== undefined) {
    return cachedFile;
  }

  let content = null;
  try {
    content = await readTextFileAsync(filename);
  } catch (_) {
    //
  }

  FILE_CONTENT_CACHE.set(filename, content);
  return content;
}

exports.ContextLines = ContextLines;
//# sourceMappingURL=contextlines.js.map


/***/ }),

/***/ 2743:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const lru_map = __webpack_require__(4218);
const http = __webpack_require__(4914);

const NODE_VERSION = utils.parseSemver(process.versions.node);

/**
 * The http module integration instruments Node's internal http module. It creates breadcrumbs, transactions for outgoing
 * http requests and attaches trace data when tracing is enabled via its `tracing` option.
 */
class Http  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Http';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Http.id;}

  /**
   * @inheritDoc
   */
   constructor(options = {}) {Http.prototype.__init.call(this);
    this._breadcrumbs = typeof options.breadcrumbs === 'undefined' ? true : options.breadcrumbs;
    this._tracing = !options.tracing ? undefined : options.tracing === true ? {} : options.tracing;
  }

  /**
   * @inheritDoc
   */
   setupOnce(
    _addGlobalEventProcessor,
    setupOnceGetCurrentHub,
  ) {
    // No need to instrument if we don't want to track anything
    if (!this._breadcrumbs && !this._tracing) {
      return;
    }

    const clientOptions = _optionalChain([setupOnceGetCurrentHub, 'call', _ => _(), 'access', _2 => _2.getClient, 'call', _3 => _3(), 'optionalAccess', _4 => _4.getOptions, 'call', _5 => _5()]);

    // Do not auto-instrument for other instrumenter
    if (clientOptions && clientOptions.instrumenter !== 'sentry') {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('HTTP Integration is skipped because of instrumenter configuration.');
      return;
    }

    // TODO (v8): `tracePropagationTargets` and `shouldCreateSpanForRequest` will be removed from clientOptions
    // and we will no longer have to do this optional merge, we can just pass `this._tracing` directly.
    const tracingOptions = this._tracing ? { ...clientOptions, ...this._tracing } : undefined;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const httpModule = __webpack_require__(3685);
    const wrappedHttpHandlerMaker = _createWrappedRequestMethodFactory(this._breadcrumbs, tracingOptions, httpModule);
    utils.fill(httpModule, 'get', wrappedHttpHandlerMaker);
    utils.fill(httpModule, 'request', wrappedHttpHandlerMaker);

    // NOTE: Prior to Node 9, `https` used internals of `http` module, thus we don't patch it.
    // If we do, we'd get double breadcrumbs and double spans for `https` calls.
    // It has been changed in Node 9, so for all versions equal and above, we patch `https` separately.
    if (NODE_VERSION.major && NODE_VERSION.major > 8) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const httpsModule = __webpack_require__(5687);
      const wrappedHttpsHandlerMaker = _createWrappedRequestMethodFactory(
        this._breadcrumbs,
        tracingOptions,
        httpsModule,
      );
      utils.fill(httpsModule, 'get', wrappedHttpsHandlerMaker);
      utils.fill(httpsModule, 'request', wrappedHttpsHandlerMaker);
    }
  }
}Http.__initStatic();

// for ease of reading below

/**
 * Function which creates a function which creates wrapped versions of internal `request` and `get` calls within `http`
 * and `https` modules. (NB: Not a typo - this is a creator^2!)
 *
 * @param breadcrumbsEnabled Whether or not to record outgoing requests as breadcrumbs
 * @param tracingEnabled Whether or not to record outgoing requests as tracing spans
 *
 * @returns A function which accepts the exiting handler and returns a wrapped handler
 */
function _createWrappedRequestMethodFactory(
  breadcrumbsEnabled,
  tracingOptions,
  httpModule,
) {
  // We're caching results so we don't have to recompute regexp every time we create a request.
  const createSpanUrlMap = new lru_map.LRUMap(100);
  const headersUrlMap = {};

  const shouldCreateSpan = (url) => {
    if (_optionalChain([tracingOptions, 'optionalAccess', _6 => _6.shouldCreateSpanForRequest]) === undefined) {
      return true;
    }

    const cachedDecision = createSpanUrlMap.get(url);
    if (cachedDecision !== undefined) {
      return cachedDecision;
    }

    const decision = tracingOptions.shouldCreateSpanForRequest(url);
    createSpanUrlMap.set(url, decision);
    return decision;
  };

  const shouldAttachTraceData = (url) => {
    if (_optionalChain([tracingOptions, 'optionalAccess', _7 => _7.tracePropagationTargets]) === undefined) {
      return true;
    }

    if (headersUrlMap[url]) {
      return headersUrlMap[url];
    }

    headersUrlMap[url] = utils.stringMatchesSomePattern(url, tracingOptions.tracePropagationTargets);

    return headersUrlMap[url];
  };

  return function wrappedRequestMethodFactory(originalRequestMethod) {
    return function wrappedMethod( ...args) {
      const requestArgs = http.normalizeRequestArgs(httpModule, args);
      const requestOptions = requestArgs[0];
      const requestUrl = http.extractUrl(requestOptions);

      // we don't want to record requests to Sentry as either breadcrumbs or spans, so just use the original method
      if (http.isSentryRequest(requestUrl)) {
        return originalRequestMethod.apply(httpModule, requestArgs);
      }

      let requestSpan;
      let parentSpan;

      const scope = core.getCurrentHub().getScope();

      if (scope && tracingOptions && shouldCreateSpan(requestUrl)) {
        parentSpan = scope.getSpan();

        if (parentSpan) {
          requestSpan = parentSpan.startChild({
            description: `${requestOptions.method || 'GET'} ${requestUrl}`,
            op: 'http.client',
          });

          if (shouldAttachTraceData(requestUrl)) {
            const sentryTraceHeader = requestSpan.toTraceparent();
            (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
              utils.logger.log(
                `[Tracing] Adding sentry-trace header ${sentryTraceHeader} to outgoing request to "${requestUrl}": `,
              );

            requestOptions.headers = {
              ...requestOptions.headers,
              'sentry-trace': sentryTraceHeader,
            };

            if (parentSpan.transaction) {
              const dynamicSamplingContext = parentSpan.transaction.getDynamicSamplingContext();
              const sentryBaggageHeader = utils.dynamicSamplingContextToSentryBaggageHeader(dynamicSamplingContext);

              let newBaggageHeaderField;
              if (!requestOptions.headers || !requestOptions.headers.baggage) {
                newBaggageHeaderField = sentryBaggageHeader;
              } else if (!sentryBaggageHeader) {
                newBaggageHeaderField = requestOptions.headers.baggage;
              } else if (Array.isArray(requestOptions.headers.baggage)) {
                newBaggageHeaderField = [...requestOptions.headers.baggage, sentryBaggageHeader];
              } else {
                // Type-cast explanation:
                // Technically this the following could be of type `(number | string)[]` but for the sake of simplicity
                // we say this is undefined behaviour, since it would not be baggage spec conform if the user did this.
                newBaggageHeaderField = [requestOptions.headers.baggage, sentryBaggageHeader] ;
              }

              requestOptions.headers = {
                ...requestOptions.headers,
                // Setting a hader to `undefined` will crash in node so we only set the baggage header when it's defined
                ...(newBaggageHeaderField && { baggage: newBaggageHeaderField }),
              };
            }
          } else {
            (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
              utils.logger.log(
                `[Tracing] Not adding sentry-trace header to outgoing request (${requestUrl}) due to mismatching tracePropagationTargets option.`,
              );
          }

          const transaction = parentSpan.transaction;
          if (transaction) {
            transaction.metadata.propagations++;
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return originalRequestMethod
        .apply(httpModule, requestArgs)
        .once('response', function ( res) {
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          const req = this;
          if (breadcrumbsEnabled) {
            addRequestBreadcrumb('response', requestUrl, req, res);
          }
          if (requestSpan) {
            if (res.statusCode) {
              requestSpan.setHttpStatus(res.statusCode);
            }
            requestSpan.description = http.cleanSpanDescription(requestSpan.description, requestOptions, req);
            requestSpan.finish();
          }
        })
        .once('error', function () {
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          const req = this;

          if (breadcrumbsEnabled) {
            addRequestBreadcrumb('error', requestUrl, req);
          }
          if (requestSpan) {
            requestSpan.setHttpStatus(500);
            requestSpan.description = http.cleanSpanDescription(requestSpan.description, requestOptions, req);
            requestSpan.finish();
          }
        });
    };
  };
}

/**
 * Captures Breadcrumb based on provided request/response pair
 */
function addRequestBreadcrumb(event, url, req, res) {
  if (!core.getCurrentHub().getIntegration(Http)) {
    return;
  }

  core.getCurrentHub().addBreadcrumb(
    {
      category: 'http',
      data: {
        method: req.method,
        status_code: res && res.statusCode,
        url,
      },
      type: 'http',
    },
    {
      event,
      request: req,
      response: res,
    },
  );
}

exports.Http = Http;
//# sourceMappingURL=http.js.map


/***/ }),

/***/ 2287:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const console = __webpack_require__(8754);
const http = __webpack_require__(2743);
const onuncaughtexception = __webpack_require__(669);
const onunhandledrejection = __webpack_require__(2307);
const linkederrors = __webpack_require__(7140);
const modules = __webpack_require__(3659);
const contextlines = __webpack_require__(7961);
const context = __webpack_require__(9574);
const requestdata = __webpack_require__(2967);
const localvariables = __webpack_require__(7468);



exports.Console = console.Console;
exports.Http = http.Http;
exports.OnUncaughtException = onuncaughtexception.OnUncaughtException;
exports.OnUnhandledRejection = onunhandledrejection.OnUnhandledRejection;
exports.LinkedErrors = linkederrors.LinkedErrors;
exports.Modules = modules.Modules;
exports.ContextLines = contextlines.ContextLines;
exports.Context = context.Context;
exports.RequestData = requestdata.RequestData;
exports.LocalVariables = localvariables.LocalVariables;
//# sourceMappingURL=index.js.map


/***/ }),

/***/ 7140:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const eventbuilder = __webpack_require__(9185);
const contextlines = __webpack_require__(7961);

const DEFAULT_KEY = 'cause';
const DEFAULT_LIMIT = 5;

/** Adds SDK info to an event. */
class LinkedErrors  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'LinkedErrors';}

  /**
   * @inheritDoc
   */
    __init() {this.name = LinkedErrors.id;}

  /**
   * @inheritDoc
   */

  /**
   * @inheritDoc
   */

  /**
   * @inheritDoc
   */
   constructor(options = {}) {LinkedErrors.prototype.__init.call(this);
    this._key = options.key || DEFAULT_KEY;
    this._limit = options.limit || DEFAULT_LIMIT;
  }

  /**
   * @inheritDoc
   */
   setupOnce() {
    core.addGlobalEventProcessor(async (event, hint) => {
      const hub = core.getCurrentHub();
      const self = hub.getIntegration(LinkedErrors);
      const client = hub.getClient();
      if (client && self && self._handler && typeof self._handler === 'function') {
        await self._handler(client.getOptions().stackParser, event, hint);
      }
      return event;
    });
  }

  /**
   * @inheritDoc
   */
   _handler(stackParser, event, hint) {
    if (!event.exception || !event.exception.values || !utils.isInstanceOf(hint.originalException, Error)) {
      return utils.resolvedSyncPromise(event);
    }

    return new utils.SyncPromise(resolve => {
      void this._walkErrorTree(stackParser, hint.originalException , this._key)
        .then((linkedErrors) => {
          if (event && event.exception && event.exception.values) {
            event.exception.values = [...linkedErrors, ...event.exception.values];
          }
          resolve(event);
        })
        .then(null, () => {
          resolve(event);
        });
    });
  }

  /**
   * @inheritDoc
   */
   async _walkErrorTree(
    stackParser,
    error,
    key,
    stack = [],
  ) {
    if (!utils.isInstanceOf(error[key], Error) || stack.length + 1 >= this._limit) {
      return Promise.resolve(stack);
    }

    const exception = eventbuilder.exceptionFromError(stackParser, error[key]);

    // If the ContextLines integration is enabled, we add source code context to linked errors
    // because we can't guarantee the order that integrations are run.
    const contextLines = core.getCurrentHub().getIntegration(contextlines.ContextLines);
    if (contextLines && _optionalChain([exception, 'access', _ => _.stacktrace, 'optionalAccess', _2 => _2.frames])) {
      await contextLines.addSourceContextToFrames(exception.stacktrace.frames);
    }

    return new Promise((resolve, reject) => {
      void this._walkErrorTree(stackParser, error[key], key, [exception, ...stack])
        .then(resolve)
        .then(null, () => {
          reject();
        });
    });
  }
}LinkedErrors.__initStatic();

exports.LinkedErrors = LinkedErrors;
//# sourceMappingURL=linkederrors.js.map


/***/ }),

/***/ 7468:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const lru_map = __webpack_require__(4218);

/**
 * Promise API is available as `Experimental` and in Node 19 only.
 *
 * Callback-based API is `Stable` since v14 and `Experimental` since v8.
 * Because of that, we are creating our own `AsyncSession` class.
 *
 * https://nodejs.org/docs/latest-v19.x/api/inspector.html#promises-api
 * https://nodejs.org/docs/latest-v14.x/api/inspector.html
 */
class AsyncSession  {

  /** Throws is inspector API is not available */
   constructor() {
    // Node can be build without inspector support so this can throw
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Session } = __webpack_require__(1405);
    this._session = new Session();
  }

  /** @inheritdoc */
   configureAndConnect(
    onPause,
    captureAll,
  ) {
    this._session.connect();
    this._session.on('Debugger.paused', onPause);
    this._session.post('Debugger.enable');
    // We only want to pause on uncaught exceptions
    this._session.post('Debugger.setPauseOnExceptions', { state: captureAll ? 'all' : 'uncaught' });
  }

  /** @inheritdoc */
   async getLocalVariables(objectId) {
    const props = await this._getProperties(objectId);
    const unrolled = {};

    for (const prop of props) {
      if (_optionalChain([prop, 'optionalAccess', _ => _.value, 'optionalAccess', _2 => _2.objectId]) && _optionalChain([prop, 'optionalAccess', _3 => _3.value, 'access', _4 => _4.className]) === 'Array') {
        unrolled[prop.name] = await this._unrollArray(prop.value.objectId);
      } else if (_optionalChain([prop, 'optionalAccess', _5 => _5.value, 'optionalAccess', _6 => _6.objectId]) && _optionalChain([prop, 'optionalAccess', _7 => _7.value, 'optionalAccess', _8 => _8.className]) === 'Object') {
        unrolled[prop.name] = await this._unrollObject(prop.value.objectId);
      } else if (_optionalChain([prop, 'optionalAccess', _9 => _9.value, 'optionalAccess', _10 => _10.value]) || _optionalChain([prop, 'optionalAccess', _11 => _11.value, 'optionalAccess', _12 => _12.description])) {
        unrolled[prop.name] = prop.value.value || `<${prop.value.description}>`;
      }
    }

    return unrolled;
  }

  /**
   * Gets all the PropertyDescriptors of an object
   */
   _getProperties(objectId) {
    return new Promise((resolve, reject) => {
      this._session.post(
        'Runtime.getProperties',
        {
          objectId,
          ownProperties: true,
        },
        (err, params) => {
          if (err) {
            reject(err);
          } else {
            resolve(params.result);
          }
        },
      );
    });
  }

  /**
   * Unrolls an array property
   */
   async _unrollArray(objectId) {
    const props = await this._getProperties(objectId);
    return props
      .filter(v => v.name !== 'length' && !isNaN(parseInt(v.name, 10)))
      .sort((a, b) => parseInt(a.name, 10) - parseInt(b.name, 10))
      .map(v => _optionalChain([v, 'optionalAccess', _13 => _13.value, 'optionalAccess', _14 => _14.value]));
  }

  /**
   * Unrolls an object property
   */
   async _unrollObject(objectId) {
    const props = await this._getProperties(objectId);
    return props
      .map(v => [v.name, _optionalChain([v, 'optionalAccess', _15 => _15.value, 'optionalAccess', _16 => _16.value])])
      .reduce((obj, [key, val]) => {
        obj[key] = val;
        return obj;
      }, {} );
  }
}

/**
 * When using Vercel pkg, the inspector module is not available.
 * https://github.com/getsentry/sentry-javascript/issues/6769
 */
function tryNewAsyncSession() {
  try {
    return new AsyncSession();
  } catch (e) {
    return undefined;
  }
}

// Add types for the exception event data

/** Could this be an anonymous function? */
function isAnonymous(name) {
  return name !== undefined && ['', '?', '<anonymous>'].includes(name);
}

/** Do the function names appear to match? */
function functionNamesMatch(a, b) {
  return a === b || (isAnonymous(a) && isAnonymous(b));
}

/** Creates a unique hash from stack frames */
function hashFrames(frames) {
  if (frames === undefined) {
    return;
  }

  // Only hash the 10 most recent frames (ie. the last 10)
  return frames.slice(-10).reduce((acc, frame) => `${acc},${frame.function},${frame.lineno},${frame.colno}`, '');
}

/**
 * We use the stack parser to create a unique hash from the exception stack trace
 * This is used to lookup vars when the exception passes through the event processor
 */
function hashFromStack(stackParser, stack) {
  if (stack === undefined) {
    return undefined;
  }

  return hashFrames(stackParser(stack, 1));
}

/**
 * Adds local variables to exception frames
 */
class LocalVariables  {
   static __initStatic() {this.id = 'LocalVariables';}

    __init() {this.name = LocalVariables.id;}

    __init2() {this._cachedFrames = new lru_map.LRUMap(20);}

   constructor(
      _options = {},
      _session = tryNewAsyncSession(),
  ) {this._options = _options;this._session = _session;LocalVariables.prototype.__init.call(this);LocalVariables.prototype.__init2.call(this);}

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor, getCurrentHub) {
    this._setup(addGlobalEventProcessor, _optionalChain([getCurrentHub, 'call', _17 => _17(), 'access', _18 => _18.getClient, 'call', _19 => _19(), 'optionalAccess', _20 => _20.getOptions, 'call', _21 => _21()]));
  }

  /** Setup in a way that's easier to call from tests */
   _setup(
    addGlobalEventProcessor,
    clientOptions,
  ) {
    if (this._session && _optionalChain([clientOptions, 'optionalAccess', _22 => _22.includeLocalVariables])) {
      this._session.configureAndConnect(
        ev => this._handlePaused(clientOptions.stackParser, ev ),
        !!this._options.captureAllExceptions,
      );

      addGlobalEventProcessor(async event => this._addLocalVariables(event));
    }
  }

  /**
   * Handle the pause event
   */
   async _handlePaused(
    stackParser,
    { params: { reason, data, callFrames } },
  ) {
    if (reason !== 'exception' && reason !== 'promiseRejection') {
      return;
    }

    // data.description contains the original error.stack
    const exceptionHash = hashFromStack(stackParser, _optionalChain([data, 'optionalAccess', _23 => _23.description]));

    if (exceptionHash == undefined) {
      return;
    }

    const framePromises = callFrames.map(async ({ scopeChain, functionName, this: obj }) => {
      const localScope = scopeChain.find(scope => scope.type === 'local');

      // obj.className is undefined in ESM modules
      const fn = obj.className === 'global' || !obj.className ? functionName : `${obj.className}.${functionName}`;

      if (_optionalChain([localScope, 'optionalAccess', _24 => _24.object, 'access', _25 => _25.objectId]) === undefined) {
        return { function: fn };
      }

      const vars = await _optionalChain([this, 'access', _26 => _26._session, 'optionalAccess', _27 => _27.getLocalVariables, 'call', _28 => _28(localScope.object.objectId)]);

      return { function: fn, vars };
    });

    // We add the un-awaited promise to the cache rather than await here otherwise the event processor
    // can be called before we're finished getting all the vars
    this._cachedFrames.set(exceptionHash, Promise.all(framePromises));
  }

  /**
   * Adds local variables event stack frames.
   */
   async _addLocalVariables(event) {
    for (const exception of _optionalChain([event, 'optionalAccess', _29 => _29.exception, 'optionalAccess', _30 => _30.values]) || []) {
      await this._addLocalVariablesToException(exception);
    }

    return event;
  }

  /**
   * Adds local variables to the exception stack frames.
   */
   async _addLocalVariablesToException(exception) {
    const hash = hashFrames(_optionalChain([exception, 'optionalAccess', _31 => _31.stacktrace, 'optionalAccess', _32 => _32.frames]));

    if (hash === undefined) {
      return;
    }

    // Check if we have local variables for an exception that matches the hash
    // delete is identical to get but also removes the entry from the cache
    const cachedFrames = await this._cachedFrames.delete(hash);

    if (cachedFrames === undefined) {
      return;
    }

    const frameCount = _optionalChain([exception, 'access', _33 => _33.stacktrace, 'optionalAccess', _34 => _34.frames, 'optionalAccess', _35 => _35.length]) || 0;

    for (let i = 0; i < frameCount; i++) {
      // Sentry frames are in reverse order
      const frameIndex = frameCount - i - 1;

      // Drop out if we run out of frames to match up
      if (!_optionalChain([exception, 'optionalAccess', _36 => _36.stacktrace, 'optionalAccess', _37 => _37.frames, 'optionalAccess', _38 => _38[frameIndex]]) || !cachedFrames[i]) {
        break;
      }

      if (
        // We need to have vars to add
        cachedFrames[i].vars === undefined ||
        // We're not interested in frames that are not in_app because the vars are not relevant
        exception.stacktrace.frames[frameIndex].in_app === false ||
        // The function names need to match
        !functionNamesMatch(exception.stacktrace.frames[frameIndex].function, cachedFrames[i].function)
      ) {
        continue;
      }

      exception.stacktrace.frames[frameIndex].vars = cachedFrames[i].vars;
    }
  }
}LocalVariables.__initStatic();

exports.LocalVariables = LocalVariables;
//# sourceMappingURL=localvariables.js.map


/***/ }),

/***/ 3659:
/***/ ((module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const fs = __webpack_require__(7147);
const path = __webpack_require__(1017);

let moduleCache;

/** Extract information about paths */
function getPaths() {
  try {
    return __webpack_require__.c ? Object.keys(__webpack_require__.c ) : [];
  } catch (e) {
    return [];
  }
}

/** Extract information about package.json modules */
function collectModules()

 {
  const mainPaths = (__webpack_require__.c[__webpack_require__.s] && __webpack_require__.c[__webpack_require__.s].paths) || [];
  const paths = getPaths();
  const infos

 = {};
  const seen

 = {};

  paths.forEach(path$1 => {
    let dir = path$1;

    /** Traverse directories upward in the search of package.json file */
    const updir = () => {
      const orig = dir;
      dir = path.dirname(orig);

      if (!dir || orig === dir || seen[orig]) {
        return undefined;
      }
      if (mainPaths.indexOf(dir) < 0) {
        return updir();
      }

      const pkgfile = path.join(orig, 'package.json');
      seen[orig] = true;

      if (!fs.existsSync(pkgfile)) {
        return updir();
      }

      try {
        const info = JSON.parse(fs.readFileSync(pkgfile, 'utf8'))

;
        infos[info.name] = info.version;
      } catch (_oO) {
        // no-empty
      }
    };

    updir();
  });

  return infos;
}

/** Add node modules / packages to the event */
class Modules  {constructor() { Modules.prototype.__init.call(this); }
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Modules';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Modules.id;}

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor, getCurrentHub) {
    addGlobalEventProcessor(event => {
      if (!getCurrentHub().getIntegration(Modules)) {
        return event;
      }
      return {
        ...event,
        modules: {
          ...event.modules,
          ...this._getModules(),
        },
      };
    });
  }

  /** Fetches the list of modules and the versions loaded by the entry file for your node.js app. */
   _getModules() {
    if (!moduleCache) {
      moduleCache = collectModules();
    }
    return moduleCache;
  }
} Modules.__initStatic();

exports.Modules = Modules;
//# sourceMappingURL=modules.js.map


/***/ }),

/***/ 669:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const errorhandling = __webpack_require__(9908);

/** Global Exception handler */
class OnUncaughtException  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'OnUncaughtException';}

  /**
   * @inheritDoc
   */
   __init() {this.name = OnUncaughtException.id;}

  /**
   * @inheritDoc
   */
    __init2() {this.handler = this._makeErrorHandler();}

  // CAREFUL: Please think twice before updating the way _options looks because the Next.js SDK depends on it in `index.server.ts`

  /**
   * @inheritDoc
   */
   constructor(options = {}) {OnUncaughtException.prototype.__init.call(this);OnUncaughtException.prototype.__init2.call(this);
    this._options = {
      exitEvenIfOtherHandlersAreRegistered: true,
      ...options,
    };
  }

  /**
   * @inheritDoc
   */
   setupOnce() {
    global.process.on('uncaughtException', this.handler);
  }

  /**
   * @hidden
   */
   _makeErrorHandler() {
    const timeout = 2000;
    let caughtFirstError = false;
    let caughtSecondError = false;
    let calledFatalError = false;
    let firstError;

    return (error) => {
      let onFatalError = errorhandling.logAndExitProcess;
      const client = core.getCurrentHub().getClient();

      if (this._options.onFatalError) {
        onFatalError = this._options.onFatalError;
      } else if (client && client.getOptions().onFatalError) {
        onFatalError = client.getOptions().onFatalError ;
      }

      // Attaching a listener to `uncaughtException` will prevent the node process from exiting. We generally do not
      // want to alter this behaviour so we check for other listeners that users may have attached themselves and adjust
      // exit behaviour of the SDK accordingly:
      // - If other listeners are attached, do not exit.
      // - If the only listener attached is ours, exit.
      const userProvidedListenersCount = global.process
        .listeners('uncaughtException')
        .reduce((acc, listener) => {
          if (
            listener.name === 'domainUncaughtExceptionClear' || // as soon as we're using domains this listener is attached by node itself
            listener === this.handler // filter the handler we registered ourselves)
          ) {
            return acc;
          } else {
            return acc + 1;
          }
        }, 0);

      const processWouldExit = userProvidedListenersCount === 0;
      const shouldApplyFatalHandlingLogic = this._options.exitEvenIfOtherHandlersAreRegistered || processWouldExit;

      if (!caughtFirstError) {
        const hub = core.getCurrentHub();

        // this is the first uncaught error and the ultimate reason for shutting down
        // we want to do absolutely everything possible to ensure it gets captured
        // also we want to make sure we don't go recursion crazy if more errors happen after this one
        firstError = error;
        caughtFirstError = true;

        if (hub.getIntegration(OnUncaughtException)) {
          hub.withScope((scope) => {
            scope.setLevel('fatal');
            hub.captureException(error, {
              originalException: error,
              data: { mechanism: { handled: false, type: 'onuncaughtexception' } },
            });
            if (!calledFatalError && shouldApplyFatalHandlingLogic) {
              calledFatalError = true;
              onFatalError(error);
            }
          });
        } else {
          if (!calledFatalError && shouldApplyFatalHandlingLogic) {
            calledFatalError = true;
            onFatalError(error);
          }
        }
      } else {
        if (shouldApplyFatalHandlingLogic) {
          if (calledFatalError) {
            // we hit an error *after* calling onFatalError - pretty boned at this point, just shut it down
            (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
              utils.logger.warn(
                'uncaught exception after calling fatal error shutdown callback - this is bad! forcing shutdown',
              );
            errorhandling.logAndExitProcess(error);
          } else if (!caughtSecondError) {
            // two cases for how we can hit this branch:
            //   - capturing of first error blew up and we just caught the exception from that
            //     - quit trying to capture, proceed with shutdown
            //   - a second independent error happened while waiting for first error to capture
            //     - want to avoid causing premature shutdown before first error capture finishes
            // it's hard to immediately tell case 1 from case 2 without doing some fancy/questionable domain stuff
            // so let's instead just delay a bit before we proceed with our action here
            // in case 1, we just wait a bit unnecessarily but ultimately do the same thing
            // in case 2, the delay hopefully made us wait long enough for the capture to finish
            // two potential nonideal outcomes:
            //   nonideal case 1: capturing fails fast, we sit around for a few seconds unnecessarily before proceeding correctly by calling onFatalError
            //   nonideal case 2: case 2 happens, 1st error is captured but slowly, timeout completes before capture and we treat second error as the sendErr of (nonexistent) failure from trying to capture first error
            // note that after hitting this branch, we might catch more errors where (caughtSecondError && !calledFatalError)
            //   we ignore them - they don't matter to us, we're just waiting for the second error timeout to finish
            caughtSecondError = true;
            setTimeout(() => {
              if (!calledFatalError) {
                // it was probably case 1, let's treat err as the sendErr and call onFatalError
                calledFatalError = true;
                onFatalError(firstError, error);
              }
            }, timeout); // capturing could take at least sendTimeout to fail, plus an arbitrary second for how long it takes to collect surrounding source etc
          }
        }
      }
    };
  }
} OnUncaughtException.__initStatic();

exports.OnUncaughtException = OnUncaughtException;
//# sourceMappingURL=onuncaughtexception.js.map


/***/ }),

/***/ 2307:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const errorhandling = __webpack_require__(9908);

/** Global Promise Rejection handler */
class OnUnhandledRejection  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'OnUnhandledRejection';}

  /**
   * @inheritDoc
   */
   __init() {this.name = OnUnhandledRejection.id;}

  /**
   * @inheritDoc
   */
   constructor(
      _options

 = { mode: 'warn' },
  ) {this._options = _options;OnUnhandledRejection.prototype.__init.call(this);}

  /**
   * @inheritDoc
   */
   setupOnce() {
    global.process.on('unhandledRejection', this.sendUnhandledPromise.bind(this));
  }

  /**
   * Send an exception with reason
   * @param reason string
   * @param promise promise
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
   sendUnhandledPromise(reason, promise) {
    const hub = core.getCurrentHub();
    if (hub.getIntegration(OnUnhandledRejection)) {
      hub.withScope((scope) => {
        scope.setExtra('unhandledPromiseRejection', true);
        hub.captureException(reason, {
          originalException: promise,
          data: { mechanism: { handled: false, type: 'onunhandledrejection' } },
        });
      });
    }
    this._handleRejection(reason);
  }

  /**
   * Handler for `mode` option
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
   _handleRejection(reason) {
    // https://github.com/nodejs/node/blob/7cf6f9e964aa00772965391c23acda6d71972a9a/lib/internal/process/promises.js#L234-L240
    const rejectionWarning =
      'This error originated either by ' +
      'throwing inside of an async function without a catch block, ' +
      'or by rejecting a promise which was not handled with .catch().' +
      ' The promise rejected with the reason:';

    /* eslint-disable no-console */
    if (this._options.mode === 'warn') {
      utils.consoleSandbox(() => {
        console.warn(rejectionWarning);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.error(reason && reason.stack ? reason.stack : reason);
      });
    } else if (this._options.mode === 'strict') {
      utils.consoleSandbox(() => {
        console.warn(rejectionWarning);
      });
      errorhandling.logAndExitProcess(reason);
    }
    /* eslint-enable no-console */
  }
} OnUnhandledRejection.__initStatic();

exports.OnUnhandledRejection = OnUnhandledRejection;
//# sourceMappingURL=onunhandledrejection.js.map


/***/ }),

/***/ 2967:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const requestdata = __webpack_require__(3098);

const DEFAULT_OPTIONS = {
  include: {
    cookies: true,
    data: true,
    headers: true,
    ip: false,
    query_string: true,
    url: true,
    user: {
      id: true,
      username: true,
      email: true,
    },
  },
  transactionNamingScheme: 'methodPath',
};

/** Add data about a request to an event. Primarily for use in Node-based SDKs, but included in `@sentry/integrations`
 * so it can be used in cross-platform SDKs like `@sentry/nextjs`. */
class RequestData  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'RequestData';}

  /**
   * @inheritDoc
   */
   __init() {this.name = RequestData.id;}

  /**
   * Function for adding request data to event. Defaults to `addRequestDataToEvent` from `@sentry/node` for now, but
   * left as a property so this integration can be moved to `@sentry/core` as a base class in case we decide to use
   * something similar in browser-based SDKs in the future.
   */

  /**
   * @inheritDoc
   */
   constructor(options = {}) {RequestData.prototype.__init.call(this);
    this._addRequestData = requestdata.addRequestDataToEvent;
    this._options = {
      ...DEFAULT_OPTIONS,
      ...options,
      include: {
        // @ts-ignore It's mad because `method` isn't a known `include` key. (It's only here and not set by default in
        // `addRequestDataToEvent` for legacy reasons. TODO (v8): Change that.)
        method: true,
        ...DEFAULT_OPTIONS.include,
        ...options.include,
        user:
          options.include && typeof options.include.user === 'boolean'
            ? options.include.user
            : {
                ...DEFAULT_OPTIONS.include.user,
                // Unclear why TS still thinks `options.include.user` could be a boolean at this point
                ...((options.include || {}).user ),
              },
      },
    };
  }

  /**
   * @inheritDoc
   */
   setupOnce(addGlobalEventProcessor, getCurrentHub) {
    // Note: In the long run, most of the logic here should probably move into the request data utility functions. For
    // the moment it lives here, though, until https://github.com/getsentry/sentry-javascript/issues/5718 is addressed.
    // (TL;DR: Those functions touch many parts of the repo in many different ways, and need to be clened up. Once
    // that's happened, it will be easier to add this logic in without worrying about unexpected side effects.)
    const { transactionNamingScheme } = this._options;

    addGlobalEventProcessor(event => {
      const hub = getCurrentHub();
      const self = hub.getIntegration(RequestData);

      const { sdkProcessingMetadata = {} } = event;
      const req = sdkProcessingMetadata.request;

      // If the globally installed instance of this integration isn't associated with the current hub, `self` will be
      // undefined
      if (!self || !req) {
        return event;
      }

      // The Express request handler takes a similar `include` option to that which can be passed to this integration.
      // If passed there, we store it in `sdkProcessingMetadata`. TODO(v8): Force express and GCP people to use this
      // integration, so that all of this passing and conversion isn't necessary
      const addRequestDataOptions =
        sdkProcessingMetadata.requestDataOptionsFromExpressHandler ||
        sdkProcessingMetadata.requestDataOptionsFromGCPWrapper ||
        convertReqDataIntegrationOptsToAddReqDataOpts(this._options);

      const processedEvent = this._addRequestData(event, req, addRequestDataOptions);

      // Transaction events already have the right `transaction` value
      if (event.type === 'transaction' || transactionNamingScheme === 'handler') {
        return processedEvent;
      }

      // In all other cases, use the request's associated transaction (if any) to overwrite the event's `transaction`
      // value with a high-quality one
      const reqWithTransaction = req ;
      const transaction = reqWithTransaction._sentryTransaction;
      if (transaction) {
        // TODO (v8): Remove the nextjs check and just base it on `transactionNamingScheme` for all SDKs. (We have to
        // keep it the way it is for the moment, because changing the names of transactions in Sentry has the potential
        // to break things like alert rules.)
        const shouldIncludeMethodInTransactionName =
          getSDKName(hub) === 'sentry.javascript.nextjs'
            ? transaction.name.startsWith('/api')
            : transactionNamingScheme !== 'path';

        const [transactionValue] = utils.extractPathForTransaction(req, {
          path: true,
          method: shouldIncludeMethodInTransactionName,
          customRoute: transaction.name,
        });

        processedEvent.transaction = transactionValue;
      }

      return processedEvent;
    });
  }
} RequestData.__initStatic();

/** Convert this integration's options to match what `addRequestDataToEvent` expects */
/** TODO: Can possibly be deleted once https://github.com/getsentry/sentry-javascript/issues/5718 is fixed */
function convertReqDataIntegrationOptsToAddReqDataOpts(
  integrationOptions,
) {
  const {
    transactionNamingScheme,
    include: { ip, user, ...requestOptions },
  } = integrationOptions;

  const requestIncludeKeys = [];
  for (const [key, value] of Object.entries(requestOptions)) {
    if (value) {
      requestIncludeKeys.push(key);
    }
  }

  let addReqDataUserOpt;
  if (user === undefined) {
    addReqDataUserOpt = true;
  } else if (typeof user === 'boolean') {
    addReqDataUserOpt = user;
  } else {
    const userIncludeKeys = [];
    for (const [key, value] of Object.entries(user)) {
      if (value) {
        userIncludeKeys.push(key);
      }
    }
    addReqDataUserOpt = userIncludeKeys;
  }

  return {
    include: {
      ip,
      user: addReqDataUserOpt,
      request: requestIncludeKeys.length !== 0 ? requestIncludeKeys : undefined,
      transaction: transactionNamingScheme,
    },
  };
}

function getSDKName(hub) {
  try {
    // For a long chain like this, it's fewer bytes to combine a try-catch with assuming everything is there than to
    // write out a long chain of `a && a.b && a.b.c && ...`
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return hub.getClient().getOptions()._metadata.sdk.name;
  } catch (err) {
    // In theory we should never get here
    return undefined;
  }
}

exports.RequestData = RequestData;
//# sourceMappingURL=requestdata.js.map


/***/ }),

/***/ 9908:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);

const DEFAULT_SHUTDOWN_TIMEOUT = 2000;

/**
 * @hidden
 */
function logAndExitProcess(error) {
  // eslint-disable-next-line no-console
  console.error(error && error.stack ? error.stack : error);

  const client = core.getCurrentHub().getClient();

  if (client === undefined) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('No NodeClient was defined, we are exiting the process now.');
    global.process.exit(1);
  }

  const options = client.getOptions();
  const timeout =
    (options && options.shutdownTimeout && options.shutdownTimeout > 0 && options.shutdownTimeout) ||
    DEFAULT_SHUTDOWN_TIMEOUT;
  client.close(timeout).then(
    (result) => {
      if (!result) {
        (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('We reached the timeout for emptying the request buffer, still exiting now!');
      }
      global.process.exit(1);
    },
    error => {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error(error);
    },
  );
}

exports.logAndExitProcess = logAndExitProcess;
//# sourceMappingURL=errorhandling.js.map


/***/ }),

/***/ 4914:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const url = __webpack_require__(7310);

const NODE_VERSION = utils.parseSemver(process.versions.node);

/**
 * Checks whether given url points to Sentry server
 * @param url url to verify
 */
function isSentryRequest(url) {
  const dsn = _optionalChain([core.getCurrentHub, 'call', _ => _(), 'access', _2 => _2.getClient, 'call', _3 => _3(), 'optionalAccess', _4 => _4.getDsn, 'call', _5 => _5()]);
  return dsn ? url.includes(dsn.host) : false;
}

/**
 * Assemble a URL to be used for breadcrumbs and spans.
 *
 * @param requestOptions RequestOptions object containing the component parts for a URL
 * @returns Fully-formed URL
 */
function extractUrl(requestOptions) {
  const protocol = requestOptions.protocol || '';
  const hostname = requestOptions.hostname || requestOptions.host || '';
  // Don't log standard :80 (http) and :443 (https) ports to reduce the noise
  const port =
    !requestOptions.port || requestOptions.port === 80 || requestOptions.port === 443 ? '' : `:${requestOptions.port}`;
  const path = requestOptions.path ? requestOptions.path : '/';

  return `${protocol}//${hostname}${port}${path}`;
}

/**
 * Handle various edge cases in the span description (for spans representing http(s) requests).
 *
 * @param description current `description` property of the span representing the request
 * @param requestOptions Configuration data for the request
 * @param Request Request object
 *
 * @returns The cleaned description
 */
function cleanSpanDescription(
  description,
  requestOptions,
  request,
) {
  // nothing to clean
  if (!description) {
    return description;
  }

  // eslint-disable-next-line prefer-const
  let [method, requestUrl] = description.split(' ');

  // superagent sticks the protocol in a weird place (we check for host because if both host *and* protocol are missing,
  // we're likely dealing with an internal route and this doesn't apply)
  if (requestOptions.host && !requestOptions.protocol) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    requestOptions.protocol = _optionalChain([(request ), 'optionalAccess', _6 => _6.agent, 'optionalAccess', _7 => _7.protocol]); // worst comes to worst, this is undefined and nothing changes
    requestUrl = extractUrl(requestOptions);
  }

  // internal routes can end up starting with a triple slash rather than a single one
  if (_optionalChain([requestUrl, 'optionalAccess', _8 => _8.startsWith, 'call', _9 => _9('///')])) {
    requestUrl = requestUrl.slice(2);
  }

  return `${method} ${requestUrl}`;
}

// the node types are missing a few properties which node's `urlToOptions` function spits out

/**
 * Convert a URL object into a RequestOptions object.
 *
 * Copied from Node's internals (where it's used in http(s).request() and http(s).get()), modified only to use the
 * RequestOptions type above.
 *
 * See https://github.com/nodejs/node/blob/master/lib/internal/url.js.
 */
function urlToOptions(url) {
  const options = {
    protocol: url.protocol,
    hostname:
      typeof url.hostname === 'string' && url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname,
    hash: url.hash,
    search: url.search,
    pathname: url.pathname,
    path: `${url.pathname || ''}${url.search || ''}`,
    href: url.href,
  };
  if (url.port !== '') {
    options.port = Number(url.port);
  }
  if (url.username || url.password) {
    options.auth = `${url.username}:${url.password}`;
  }
  return options;
}

/**
 * Normalize inputs to `http(s).request()` and `http(s).get()`.
 *
 * Legal inputs to `http(s).request()` and `http(s).get()` can take one of ten forms:
 *     [ RequestOptions | string | URL ],
 *     [ RequestOptions | string | URL, RequestCallback ],
 *     [ string | URL, RequestOptions ], and
 *     [ string | URL, RequestOptions, RequestCallback ].
 *
 * This standardizes to one of two forms: [ RequestOptions ] and [ RequestOptions, RequestCallback ]. A similar thing is
 * done as the first step of `http(s).request()` and `http(s).get()`; this just does it early so that we can interact
 * with the args in a standard way.
 *
 * @param requestArgs The inputs to `http(s).request()` or `http(s).get()`, as an array.
 *
 * @returns Equivalent args of the form [ RequestOptions ] or [ RequestOptions, RequestCallback ].
 */
function normalizeRequestArgs(
  httpModule,
  requestArgs,
) {
  let callback, requestOptions;

  // pop off the callback, if there is one
  if (typeof requestArgs[requestArgs.length - 1] === 'function') {
    callback = requestArgs.pop() ;
  }

  // create a RequestOptions object of whatever's at index 0
  if (typeof requestArgs[0] === 'string') {
    requestOptions = urlToOptions(new url.URL(requestArgs[0]));
  } else if (requestArgs[0] instanceof url.URL) {
    requestOptions = urlToOptions(requestArgs[0]);
  } else {
    requestOptions = requestArgs[0];
  }

  // if the options were given separately from the URL, fold them in
  if (requestArgs.length === 2) {
    requestOptions = { ...requestOptions, ...requestArgs[1] };
  }

  // Figure out the protocol if it's currently missing
  if (requestOptions.protocol === undefined) {
    // Worst case we end up populating protocol with undefined, which it already is
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

    // NOTE: Prior to Node 9, `https` used internals of `http` module, thus we don't patch it.
    // Because of that, we cannot rely on `httpModule` to provide us with valid protocol,
    // as it will always return `http`, even when using `https` module.
    //
    // See test/integrations/http.test.ts for more details on Node <=v8 protocol issue.
    if (NODE_VERSION.major && NODE_VERSION.major > 8) {
      requestOptions.protocol =
        _optionalChain([(_optionalChain([httpModule, 'optionalAccess', _10 => _10.globalAgent]) ), 'optionalAccess', _11 => _11.protocol]) ||
        _optionalChain([(requestOptions.agent ), 'optionalAccess', _12 => _12.protocol]) ||
        _optionalChain([(requestOptions._defaultAgent ), 'optionalAccess', _13 => _13.protocol]);
    } else {
      requestOptions.protocol =
        _optionalChain([(requestOptions.agent ), 'optionalAccess', _14 => _14.protocol]) ||
        _optionalChain([(requestOptions._defaultAgent ), 'optionalAccess', _15 => _15.protocol]) ||
        _optionalChain([(_optionalChain([httpModule, 'optionalAccess', _16 => _16.globalAgent]) ), 'optionalAccess', _17 => _17.protocol]);
    }
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
  }

  // return args in standardized form
  if (callback) {
    return [requestOptions, callback];
  } else {
    return [requestOptions];
  }
}

exports.cleanSpanDescription = cleanSpanDescription;
exports.extractUrl = extractUrl;
exports.isSentryRequest = isSentryRequest;
exports.normalizeRequestArgs = normalizeRequestArgs;
exports.urlToOptions = urlToOptions;
//# sourceMappingURL=http.js.map


/***/ }),

/***/ 4994:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

/** normalizes Windows paths */
function normalizePath(path) {
  return path
    .replace(/^[A-Z]:/, '') // remove Windows-style prefix
    .replace(/\\/g, '/'); // replace all `\` instances with `/`
}

/** Gets the module from a filename */
function getModule(filename) {
  if (!filename) {
    return;
  }

  const normalizedFilename = normalizePath(filename);

  // We could use optional chaining here but webpack does like that mixed with require
  const base = normalizePath(
    `${( true && __webpack_require__.c[__webpack_require__.s] && __webpack_require__.c[__webpack_require__.s].filename && utils.dirname(__webpack_require__.c[__webpack_require__.s].filename)) || global.process.cwd()}/`,
  );

  // It's specifically a module
  const file = utils.basename(normalizedFilename, '.js');

  const path = utils.dirname(normalizedFilename);
  let n = path.lastIndexOf('/node_modules/');
  if (n > -1) {
    // /node_modules/ is 14 chars
    return `${path.slice(n + 14).replace(/\//g, '.')}:${file}`;
  }
  // Let's see if it's a part of the main module
  // To be a part of main module, it has to share the same base
  n = `${path}/`.lastIndexOf(base, 0);

  if (n === 0) {
    let moduleName = path.slice(base.length).replace(/\//g, '.');
    if (moduleName) {
      moduleName += ':';
    }
    moduleName += file;
    return moduleName;
  }
  return file;
}

exports.getModule = getModule;
//# sourceMappingURL=module.js.map


/***/ }),

/***/ 404:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const requestdata = __webpack_require__(3098);

/**
 * @deprecated `Handlers.ExpressRequest` is deprecated and will be removed in v8. Use `PolymorphicRequest` instead.
 */

/**
 * Normalizes data from the request object, accounting for framework differences.
 *
 * @deprecated `Handlers.extractRequestData` is deprecated and will be removed in v8. Use `extractRequestData` instead.
 *
 * @param req The request object from which to extract data
 * @param keys An optional array of keys to include in the normalized data.
 * @returns An object containing normalized request data
 */
function extractRequestData(req, keys) {
  return requestdata.extractRequestData(req, { include: keys });
}

/**
 * Options deciding what parts of the request to use when enhancing an event
 *
 * @deprecated `Handlers.ParseRequestOptions` is deprecated and will be removed in v8. Use
 * `AddRequestDataToEventOptions` in `@sentry/utils` instead.
 */

/**
 * Enriches passed event with request data.
 *
 * @deprecated `Handlers.parseRequest` is deprecated and will be removed in v8. Use `addRequestDataToEvent` instead.
 *
 * @param event Will be mutated and enriched with req data
 * @param req Request object
 * @param options object containing flags to enable functionality
 * @hidden
 */
function parseRequest(event, req, options = {}) {
  return requestdata.addRequestDataToEvent(event, req, { include: options });
}

exports.extractRequestData = extractRequestData;
exports.parseRequest = parseRequest;
//# sourceMappingURL=requestDataDeprecated.js.map


/***/ }),

/***/ 3098:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const cookie = __webpack_require__(1373);
const url = __webpack_require__(7310);

const DEFAULT_INCLUDES = {
  ip: false,
  request: true,
  transaction: true,
  user: true,
};
const DEFAULT_REQUEST_INCLUDES = ['cookies', 'data', 'headers', 'method', 'query_string', 'url'];
const DEFAULT_USER_INCLUDES = ['id', 'username', 'email'];

/**
 * Extracts a complete and parameterized path from the request object and uses it to construct transaction name.
 * If the parameterized transaction name cannot be extracted, we fall back to the raw URL.
 *
 * Additionally, this function determines and returns the transaction name source
 *
 * eg. GET /mountpoint/user/:id
 *
 * @param req A request object
 * @param options What to include in the transaction name (method, path, or a custom route name to be
 *                used instead of the request's route)
 *
 * @returns A tuple of the fully constructed transaction name [0] and its source [1] (can be either 'route' or 'url')
 */
function extractPathForTransaction(
  req,
  options = {},
) {
  const method = req.method && req.method.toUpperCase();

  let path = '';
  let source = 'url';

  // Check to see if there's a parameterized route we can use (as there is in Express)
  if (options.customRoute || req.route) {
    path = options.customRoute || `${req.baseUrl || ''}${req.route && req.route.path}`;
    source = 'route';
  }

  // Otherwise, just take the original URL
  else if (req.originalUrl || req.url) {
    path = utils.stripUrlQueryAndFragment(req.originalUrl || req.url || '');
  }

  let name = '';
  if (options.method && method) {
    name += method;
  }
  if (options.method && options.path) {
    name += ' ';
  }
  if (options.path && path) {
    name += path;
  }

  return [name, source];
}

/** JSDoc */
function extractTransaction(req, type) {
  switch (type) {
    case 'path': {
      return extractPathForTransaction(req, { path: true })[0];
    }
    case 'handler': {
      return (req.route && req.route.stack && req.route.stack[0] && req.route.stack[0].name) || '<anonymous>';
    }
    case 'methodPath':
    default: {
      return extractPathForTransaction(req, { path: true, method: true })[0];
    }
  }
}

/** JSDoc */
function extractUserData(
  user

,
  keys,
) {
  const extractedUser = {};
  const attributes = Array.isArray(keys) ? keys : DEFAULT_USER_INCLUDES;

  attributes.forEach(key => {
    if (user && key in user) {
      extractedUser[key] = user[key];
    }
  });

  return extractedUser;
}

/**
 * Normalize data from the request object
 *
 * @param req The request object from which to extract data
 * @param options.include An optional array of keys to include in the normalized data. Defaults to
 * DEFAULT_REQUEST_INCLUDES if not provided.
 * @param options.deps Injected, platform-specific dependencies
 *
 * @returns An object containing normalized request data
 */
function extractRequestData(
  req,
  options

,
) {
  const { include = DEFAULT_REQUEST_INCLUDES } = options || {};
  const requestData = {};

  // headers:
  //   node, express, koa, nextjs: req.headers
  const headers = (req.headers || {})

;
  // method:
  //   node, express, koa, nextjs: req.method
  const method = req.method;
  // host:
  //   express: req.hostname in > 4 and req.host in < 4
  //   koa: req.host
  //   node, nextjs: req.headers.host
  const host = req.hostname || req.host || headers.host || '<no host>';
  // protocol:
  //   node, nextjs: <n/a>
  //   express, koa: req.protocol
  const protocol = req.protocol === 'https' || (req.socket && req.socket.encrypted) ? 'https' : 'http';
  // url (including path and query string):
  //   node, express: req.originalUrl
  //   koa, nextjs: req.url
  const originalUrl = req.originalUrl || req.url || '';
  // absolute url
  const absoluteUrl = originalUrl.startsWith(protocol) ? originalUrl : `${protocol}://${host}${originalUrl}`;
  include.forEach(key => {
    switch (key) {
      case 'headers': {
        requestData.headers = headers;

        // Remove the Cookie header in case cookie data should not be included in the event
        if (!include.includes('cookies')) {
          delete (requestData.headers ).cookie;
        }

        break;
      }
      case 'method': {
        requestData.method = method;
        break;
      }
      case 'url': {
        requestData.url = absoluteUrl;
        break;
      }
      case 'cookies': {
        // cookies:
        //   node, express, koa: req.headers.cookie
        //   vercel, sails.js, express (w/ cookie middleware), nextjs: req.cookies
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        requestData.cookies =
          // TODO (v8 / #5257): We're only sending the empty object for backwards compatibility, so the last bit can
          // come off in v8
          req.cookies || (headers.cookie && cookie.parse(headers.cookie)) || {};
        break;
      }
      case 'query_string': {
        // query string:
        //   node: req.url (raw)
        //   express, koa, nextjs: req.query
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        requestData.query_string = extractQueryParams(req);
        break;
      }
      case 'data': {
        if (method === 'GET' || method === 'HEAD') {
          break;
        }
        // body data:
        //   express, koa, nextjs: req.body
        //
        //   when using node by itself, you have to read the incoming stream(see
        //   https://nodejs.dev/learn/get-http-request-body-data-using-nodejs); if a user is doing that, we can't know
        //   where they're going to store the final result, so they'll have to capture this data themselves
        if (req.body !== undefined) {
          requestData.data = utils.isString(req.body) ? req.body : JSON.stringify(utils.normalize(req.body));
        }
        break;
      }
      default: {
        if ({}.hasOwnProperty.call(req, key)) {
          requestData[key] = (req )[key];
        }
      }
    }
  });

  return requestData;
}

/**
 * Add data from the given request to the given event
 *
 * @param event The event to which the request data will be added
 * @param req Request object
 * @param options.include Flags to control what data is included
 *
 * @returns The mutated `Event` object
 */
function addRequestDataToEvent(
  event,
  req,
  options,
) {
  const include = {
    ...DEFAULT_INCLUDES,
    ..._optionalChain([options, 'optionalAccess', _ => _.include]),
  };

  if (include.request) {
    const extractedRequestData = Array.isArray(include.request)
      ? extractRequestData(req, { include: include.request })
      : extractRequestData(req);

    event.request = {
      ...event.request,
      ...extractedRequestData,
    };
  }

  if (include.user) {
    const extractedUser = req.user && utils.isPlainObject(req.user) ? extractUserData(req.user, include.user) : {};

    if (Object.keys(extractedUser).length) {
      event.user = {
        ...event.user,
        ...extractedUser,
      };
    }
  }

  // client ip:
  //   node, nextjs: req.socket.remoteAddress
  //   express, koa: req.ip
  if (include.ip) {
    const ip = req.ip || (req.socket && req.socket.remoteAddress);
    if (ip) {
      event.user = {
        ...event.user,
        ip_address: ip,
      };
    }
  }

  if (include.transaction && !event.transaction) {
    // TODO do we even need this anymore?
    // TODO make this work for nextjs
    event.transaction = extractTransaction(req, include.transaction);
  }

  return event;
}

function extractQueryParams(req) {
  // url (including path and query string):
  //   node, express: req.originalUrl
  //   koa, nextjs: req.url
  let originalUrl = req.originalUrl || req.url || '';

  if (!originalUrl) {
    return;
  }

  // The `URL` constructor can't handle internal URLs of the form `/some/path/here`, so stick a dummy protocol and
  // hostname on the beginning. Since the point here is just to grab the query string, it doesn't matter what we use.
  if (originalUrl.startsWith('/')) {
    originalUrl = `http://dogs.are.great${originalUrl}`;
  }

  return (
    req.query ||
    (typeof URL !== undefined && new URL(originalUrl).search.replace('?', '')) ||
    // In Node 8, `URL` isn't in the global scope, so we have to use the built-in module from Node
    url.parse(originalUrl).query ||
    undefined
  );
}

exports.DEFAULT_USER_INCLUDES = DEFAULT_USER_INCLUDES;
exports.addRequestDataToEvent = addRequestDataToEvent;
exports.extractPathForTransaction = extractPathForTransaction;
exports.extractRequestData = extractRequestData;
//# sourceMappingURL=requestdata.js.map


/***/ }),

/***/ 2339:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const domain = __webpack_require__(3639);
const client = __webpack_require__(4911);
const console = __webpack_require__(8754);
const http = __webpack_require__(2743);
const onuncaughtexception = __webpack_require__(669);
const onunhandledrejection = __webpack_require__(2307);
const linkederrors = __webpack_require__(7140);
const modules = __webpack_require__(3659);
const contextlines = __webpack_require__(7961);
const context = __webpack_require__(9574);
const requestdata = __webpack_require__(2967);
const localvariables = __webpack_require__(7468);
const module$1 = __webpack_require__(4994);
const http$1 = __webpack_require__(2356);

/* eslint-disable max-lines */

const defaultIntegrations = [
  // Common
  new core.Integrations.InboundFilters(),
  new core.Integrations.FunctionToString(),
  // Native Wrappers
  new console.Console(),
  new http.Http(),
  // Global Handlers
  new onuncaughtexception.OnUncaughtException(),
  new onunhandledrejection.OnUnhandledRejection(),
  // Event Info
  new contextlines.ContextLines(),
  new localvariables.LocalVariables(),
  new context.Context(),
  new modules.Modules(),
  new requestdata.RequestData(),
  // Misc
  new linkederrors.LinkedErrors(),
];

/**
 * The Sentry Node SDK Client.
 *
 * To use this SDK, call the {@link init} function as early as possible in the
 * main entry module. To set context information or send manual events, use the
 * provided methods.
 *
 * @example
 * ```
 *
 * const { init } = require('@sentry/node');
 *
 * init({
 *   dsn: '__DSN__',
 *   // ...
 * });
 * ```
 *
 * @example
 * ```
 *
 * const { configureScope } = require('@sentry/node');
 * configureScope((scope: Scope) => {
 *   scope.setExtra({ battery: 0.7 });
 *   scope.setTag({ user_mode: 'admin' });
 *   scope.setUser({ id: '4711' });
 * });
 * ```
 *
 * @example
 * ```
 *
 * const { addBreadcrumb } = require('@sentry/node');
 * addBreadcrumb({
 *   message: 'My Breadcrumb',
 *   // ...
 * });
 * ```
 *
 * @example
 * ```
 *
 * const Sentry = require('@sentry/node');
 * Sentry.captureMessage('Hello, world!');
 * Sentry.captureException(new Error('Good bye'));
 * Sentry.captureEvent({
 *   message: 'Manual',
 *   stacktrace: [
 *     // ...
 *   ],
 * });
 * ```
 *
 * @see {@link NodeOptions} for documentation on configuration options.
 */
function init(options = {}) {
  const carrier = core.getMainCarrier();
  const autoloadedIntegrations = _optionalChain([carrier, 'access', _ => _.__SENTRY__, 'optionalAccess', _2 => _2.integrations]) || [];

  options.defaultIntegrations =
    options.defaultIntegrations === false
      ? []
      : [
          ...(Array.isArray(options.defaultIntegrations) ? options.defaultIntegrations : defaultIntegrations),
          ...autoloadedIntegrations,
        ];

  if (options.dsn === undefined && process.env.SENTRY_DSN) {
    options.dsn = process.env.SENTRY_DSN;
  }

  if (options.tracesSampleRate === undefined && process.env.SENTRY_TRACES_SAMPLE_RATE) {
    const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE);
    if (isFinite(tracesSampleRate)) {
      options.tracesSampleRate = tracesSampleRate;
    }
  }

  if (options.release === undefined) {
    const detectedRelease = getSentryRelease();
    if (detectedRelease !== undefined) {
      options.release = detectedRelease;
    } else {
      // If release is not provided, then we should disable autoSessionTracking
      options.autoSessionTracking = false;
    }
  }

  if (options.environment === undefined && process.env.SENTRY_ENVIRONMENT) {
    options.environment = process.env.SENTRY_ENVIRONMENT;
  }

  if (options.autoSessionTracking === undefined && options.dsn !== undefined) {
    options.autoSessionTracking = true;
  }

  if (options.instrumenter === undefined) {
    options.instrumenter = 'sentry';
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  if ((domain ).active) {
    core.setHubOnCarrier(carrier, core.getCurrentHub());
  }

  // TODO(v7): Refactor this to reduce the logic above
  const clientOptions = {
    ...options,
    stackParser: utils.stackParserFromStackParserOptions(options.stackParser || defaultStackParser),
    integrations: core.getIntegrationsToSetup(options),
    transport: options.transport || http$1.makeNodeTransport,
  };

  core.initAndBind(client.NodeClient, clientOptions);

  if (options.autoSessionTracking) {
    startSessionTracking();
  }
}

/**
 * This is the getter for lastEventId.
 *
 * @returns The last event id of a captured event.
 */
function lastEventId() {
  return core.getCurrentHub().lastEventId();
}

/**
 * Call `flush()` on the current client, if there is one. See {@link Client.flush}.
 *
 * @param timeout Maximum time in ms the client should wait to flush its event queue. Omitting this parameter will cause
 * the client to wait until all events are sent before resolving the promise.
 * @returns A promise which resolves to `true` if the queue successfully drains before the timeout, or `false` if it
 * doesn't (or if there's no client defined).
 */
async function flush(timeout) {
  const client = core.getCurrentHub().getClient();
  if (client) {
    return client.flush(timeout);
  }
  (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('Cannot flush events. No client defined.');
  return Promise.resolve(false);
}

/**
 * Call `close()` on the current client, if there is one. See {@link Client.close}.
 *
 * @param timeout Maximum time in ms the client should wait to flush its event queue before shutting down. Omitting this
 * parameter will cause the client to wait until all events are sent before disabling itself.
 * @returns A promise which resolves to `true` if the queue successfully drains before the timeout, or `false` if it
 * doesn't (or if there's no client defined).
 */
async function close(timeout) {
  const client = core.getCurrentHub().getClient();
  if (client) {
    return client.close(timeout);
  }
  (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('Cannot flush events and disable SDK. No client defined.');
  return Promise.resolve(false);
}

/**
 * Function that takes an instance of NodeClient and checks if autoSessionTracking option is enabled for that client
 */
function isAutoSessionTrackingEnabled(client) {
  if (client === undefined) {
    return false;
  }
  const clientOptions = client && client.getOptions();
  if (clientOptions && clientOptions.autoSessionTracking !== undefined) {
    return clientOptions.autoSessionTracking;
  }
  return false;
}

/**
 * Returns a release dynamically from environment variables.
 */
function getSentryRelease(fallback) {
  // Always read first as Sentry takes this as precedence
  if (process.env.SENTRY_RELEASE) {
    return process.env.SENTRY_RELEASE;
  }

  // This supports the variable that sentry-webpack-plugin injects
  if (utils.GLOBAL_OBJ.SENTRY_RELEASE && utils.GLOBAL_OBJ.SENTRY_RELEASE.id) {
    return utils.GLOBAL_OBJ.SENTRY_RELEASE.id;
  }

  return (
    // GitHub Actions - https://help.github.com/en/actions/configuring-and-managing-workflows/using-environment-variables#default-environment-variables
    process.env.GITHUB_SHA ||
    // Netlify - https://docs.netlify.com/configure-builds/environment-variables/#build-metadata
    process.env.COMMIT_REF ||
    // Vercel - https://vercel.com/docs/v2/build-step#system-environment-variables
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GITHUB_COMMIT_SHA ||
    process.env.VERCEL_GITLAB_COMMIT_SHA ||
    process.env.VERCEL_BITBUCKET_COMMIT_SHA ||
    // Zeit (now known as Vercel)
    process.env.ZEIT_GITHUB_COMMIT_SHA ||
    process.env.ZEIT_GITLAB_COMMIT_SHA ||
    process.env.ZEIT_BITBUCKET_COMMIT_SHA ||
    fallback
  );
}

/** Node.js stack parser */
const defaultStackParser = utils.createStackParser(utils.nodeStackLineParser(module$1.getModule));

/**
 * Enable automatic Session Tracking for the node process.
 */
function startSessionTracking() {
  const hub = core.getCurrentHub();
  hub.startSession();
  // Emitted in the case of healthy sessions, error of `mechanism.handled: true` and unhandledrejections because
  // The 'beforeExit' event is not emitted for conditions causing explicit termination,
  // such as calling process.exit() or uncaught exceptions.
  // Ref: https://nodejs.org/api/process.html#process_event_beforeexit
  process.on('beforeExit', () => {
    const session = _optionalChain([hub, 'access', _3 => _3.getScope, 'call', _4 => _4(), 'optionalAccess', _5 => _5.getSession, 'call', _6 => _6()]);
    const terminalStates = ['exited', 'crashed'];
    // Only call endSession, if the Session exists on Scope and SessionStatus is not a
    // Terminal Status i.e. Exited or Crashed because
    // "When a session is moved away from ok it must not be updated anymore."
    // Ref: https://develop.sentry.dev/sdk/sessions/
    if (session && !terminalStates.includes(session.status)) hub.endSession();
  });
}

exports.close = close;
exports.defaultIntegrations = defaultIntegrations;
exports.defaultStackParser = defaultStackParser;
exports.flush = flush;
exports.getSentryRelease = getSentryRelease;
exports.init = init;
exports.isAutoSessionTrackingEnabled = isAutoSessionTrackingEnabled;
exports.lastEventId = lastEventId;
//# sourceMappingURL=sdk.js.map


/***/ }),

/***/ 2356:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _nullishCoalesce
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const http = __webpack_require__(3685);
const https = __webpack_require__(5687);
const stream = __webpack_require__(2781);
const url = __webpack_require__(7310);
const zlib = __webpack_require__(9796);

// Estimated maximum size for reasonable standalone event
const GZIP_THRESHOLD = 1024 * 32;

/**
 * Gets a stream from a Uint8Array or string
 * Readable.from is ideal but was added in node.js v12.3.0 and v10.17.0
 */
function streamFromBody(body) {
  return new stream.Readable({
    read() {
      this.push(body);
      this.push(null);
    },
  });
}

/**
 * Creates a Transport that uses native the native 'http' and 'https' modules to send events to Sentry.
 */
function makeNodeTransport(options) {
  let urlSegments;

  try {
    urlSegments = new url.URL(options.url);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[@sentry/node]: Invalid dsn or tunnel option, will not send any events. The tunnel option must be a full URL when used.',
    );
    return core.createTransport(options, () => Promise.resolve({}));
  }

  const isHttps = urlSegments.protocol === 'https:';

  // Proxy prioritization: http => `options.proxy` | `process.env.http_proxy`
  // Proxy prioritization: https => `options.proxy` | `process.env.https_proxy` | `process.env.http_proxy`
  const proxy = applyNoProxyOption(
    urlSegments,
    options.proxy || (isHttps ? process.env.https_proxy : undefined) || process.env.http_proxy,
  );

  const nativeHttpModule = isHttps ? https : http;
  const keepAlive = options.keepAlive === undefined ? false : options.keepAlive;

  // TODO(v7): Evaluate if we can set keepAlive to true. This would involve testing for memory leaks in older node
  // versions(>= 8) as they had memory leaks when using it: #2555
  const agent = proxy
    ? // eslint-disable-next-line @typescript-eslint/no-var-requires
      (new (__webpack_require__(2403))(proxy) )
    : new nativeHttpModule.Agent({ keepAlive, maxSockets: 30, timeout: 2000 });

  const requestExecutor = createRequestExecutor(options, _nullishCoalesce(options.httpModule, () => ( nativeHttpModule)), agent);
  return core.createTransport(options, requestExecutor);
}

/**
 * Honors the `no_proxy` env variable with the highest priority to allow for hosts exclusion.
 *
 * @param transportUrl The URL the transport intends to send events to.
 * @param proxy The client configured proxy.
 * @returns A proxy the transport should use.
 */
function applyNoProxyOption(transportUrlSegments, proxy) {
  const { no_proxy } = process.env;

  const urlIsExemptFromProxy =
    no_proxy &&
    no_proxy
      .split(',')
      .some(
        exemption => transportUrlSegments.host.endsWith(exemption) || transportUrlSegments.hostname.endsWith(exemption),
      );

  if (urlIsExemptFromProxy) {
    return undefined;
  } else {
    return proxy;
  }
}

/**
 * Creates a RequestExecutor to be used with `createTransport`.
 */
function createRequestExecutor(
  options,
  httpModule,
  agent,
) {
  const { hostname, pathname, port, protocol, search } = new url.URL(options.url);
  return function makeRequest(request) {
    return new Promise((resolve, reject) => {
      let body = streamFromBody(request.body);

      const headers = { ...options.headers };

      if (request.body.length > GZIP_THRESHOLD) {
        headers['content-encoding'] = 'gzip';
        body = body.pipe(zlib.createGzip());
      }

      const req = httpModule.request(
        {
          method: 'POST',
          agent,
          headers,
          hostname,
          path: `${pathname}${search}`,
          port,
          protocol,
          ca: options.caCerts,
        },
        res => {
          res.on('data', () => {
            // Drain socket
          });

          res.on('end', () => {
            // Drain socket
          });

          res.setEncoding('utf8');

          // "Key-value pairs of header names and values. Header names are lower-cased."
          // https://nodejs.org/api/http.html#http_message_headers
          const retryAfterHeader = _nullishCoalesce(res.headers['retry-after'], () => ( null));
          const rateLimitsHeader = _nullishCoalesce(res.headers['x-sentry-rate-limits'], () => ( null));

          resolve({
            statusCode: res.statusCode,
            headers: {
              'retry-after': retryAfterHeader,
              'x-sentry-rate-limits': Array.isArray(rateLimitsHeader) ? rateLimitsHeader[0] : rateLimitsHeader,
            },
          });
        },
      );

      req.on('error', reject);
      body.pipe(req);
    });
  };
}

exports.makeNodeTransport = makeNodeTransport;
//# sourceMappingURL=http.js.map


/***/ }),

/***/ 8797:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const fs = __webpack_require__(7147);
const path = __webpack_require__(1017);

/**
 * Recursively read the contents of a directory.
 *
 * @param targetDir Absolute or relative path of the directory to scan. All returned paths will be relative to this
 * directory.
 * @returns Array holding all relative paths
 */
function deepReadDirSync(targetDir) {
  const targetDirAbsPath = path.resolve(targetDir);

  if (!fs.existsSync(targetDirAbsPath)) {
    throw new Error(`Cannot read contents of ${targetDirAbsPath}. Directory does not exist.`);
  }

  if (!fs.statSync(targetDirAbsPath).isDirectory()) {
    throw new Error(`Cannot read contents of ${targetDirAbsPath}, because it is not a directory.`);
  }

  // This does the same thing as its containing function, `deepReadDirSync` (except that - purely for convenience - it
  // deals in absolute paths rather than relative ones). We need this to be separate from the outer function to preserve
  // the difference between `targetDirAbsPath` and `currentDirAbsPath`.
  const deepReadCurrentDir = (currentDirAbsPath) => {
    return fs.readdirSync(currentDirAbsPath).reduce((absPaths, itemName) => {
      const itemAbsPath = path.join(currentDirAbsPath, itemName);

      if (fs.statSync(itemAbsPath).isDirectory()) {
        return [...absPaths, ...deepReadCurrentDir(itemAbsPath)];
      }

      return [...absPaths, itemAbsPath];
    }, []);
  };

  return deepReadCurrentDir(targetDirAbsPath).map(absPath => path.relative(targetDirAbsPath, absPath));
}

exports.deepReadDirSync = deepReadDirSync;
//# sourceMappingURL=utils.js.map


/***/ }),

/***/ 472:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils$1 = __webpack_require__(9425);
const utils = __webpack_require__(562);
const types = __webpack_require__(5771);

/**
 * Add a listener that cancels and finishes a transaction when the global
 * document is hidden.
 */
function registerBackgroundTabDetection() {
  if (types.WINDOW && types.WINDOW.document) {
    types.WINDOW.document.addEventListener('visibilitychange', () => {
      const activeTransaction = utils.getActiveTransaction() ;
      if (types.WINDOW.document.hidden && activeTransaction) {
        const statusType = 'cancelled';

        (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
          utils$1.logger.log(
            `[Tracing] Transaction: ${statusType} -> since tab moved to the background, op: ${activeTransaction.op}`,
          );
        // We should not set status if it is already set, this prevent important statuses like
        // error or data loss from being overwritten on transaction.
        if (!activeTransaction.status) {
          activeTransaction.setStatus(statusType);
        }
        activeTransaction.setTag('visibilitychange', 'document.hidden');
        activeTransaction.finish();
      }
    });
  } else {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
      utils$1.logger.warn('[Tracing] Could not set up background tab detection due to lack of global document');
  }
}

exports.registerBackgroundTabDetection = registerBackgroundTabDetection;
//# sourceMappingURL=backgroundtab.js.map


/***/ }),

/***/ 9370:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const hubextensions = __webpack_require__(6411);
const idletransaction = __webpack_require__(5795);
__webpack_require__(3377);
const backgroundtab = __webpack_require__(472);
const index = __webpack_require__(1480);
const request = __webpack_require__(5592);
const router = __webpack_require__(9554);
const types = __webpack_require__(5771);

const BROWSER_TRACING_INTEGRATION_ID = 'BrowserTracing';

/** Options for Browser Tracing integration */

const DEFAULT_BROWSER_TRACING_OPTIONS = {
  idleTimeout: idletransaction.DEFAULT_IDLE_TIMEOUT,
  finalTimeout: idletransaction.DEFAULT_FINAL_TIMEOUT,
  heartbeatInterval: idletransaction.DEFAULT_HEARTBEAT_INTERVAL,
  markBackgroundTransactions: true,
  routingInstrumentation: router.instrumentRoutingWithDefaults,
  startTransactionOnLocationChange: true,
  startTransactionOnPageLoad: true,
  enableLongTask: true,
  _experiments: {},
  ...request.defaultRequestInstrumentationOptions,
};

/**
 * The Browser Tracing integration automatically instruments browser pageload/navigation
 * actions as transactions, and captures requests, metrics and errors as spans.
 *
 * The integration can be configured with a variety of options, and can be extended to use
 * any routing library. This integration uses {@see IdleTransaction} to create transactions.
 */
class BrowserTracing  {
  // This class currently doesn't have a static `id` field like the other integration classes, because it prevented
  // @sentry/tracing from being treeshaken. Tree shakers do not like static fields, because they behave like side effects.
  // TODO: Come up with a better plan, than using static fields on integration classes, and use that plan on all
  // integrations.

  /** Browser Tracing integration options */

  /**
   * @inheritDoc
   */
   __init() {this.name = BROWSER_TRACING_INTEGRATION_ID;}

   constructor(_options) {BrowserTracing.prototype.__init.call(this);
    this.options = {
      ...DEFAULT_BROWSER_TRACING_OPTIONS,
      ..._options,
    };

    // Special case: enableLongTask can be set in _experiments
    // TODO (v8): Remove this in v8
    if (this.options._experiments.enableLongTask !== undefined) {
      this.options.enableLongTask = this.options._experiments.enableLongTask;
    }

    // TODO (v8): remove this block after tracingOrigins is removed
    // Set tracePropagationTargets to tracingOrigins if specified by the user
    // In case both are specified, tracePropagationTargets takes precedence
    // eslint-disable-next-line deprecation/deprecation
    if (_options && !_options.tracePropagationTargets && _options.tracingOrigins) {
      // eslint-disable-next-line deprecation/deprecation
      this.options.tracePropagationTargets = _options.tracingOrigins;
    }

    index.startTrackingWebVitals();
    if (this.options.enableLongTask) {
      index.startTrackingLongTasks();
    }
  }

  /**
   * @inheritDoc
   */
   setupOnce(_, getCurrentHub) {
    this._getCurrentHub = getCurrentHub;

    const {
      routingInstrumentation: instrumentRouting,
      startTransactionOnLocationChange,
      startTransactionOnPageLoad,
      markBackgroundTransactions,
      traceFetch,
      traceXHR,
      tracePropagationTargets,
      shouldCreateSpanForRequest,
      _experiments,
    } = this.options;

    instrumentRouting(
      (context) => this._createRouteTransaction(context),
      startTransactionOnPageLoad,
      startTransactionOnLocationChange,
    );

    if (markBackgroundTransactions) {
      backgroundtab.registerBackgroundTabDetection();
    }

    if (_experiments.enableInteractions) {
      this._registerInteractionListener();
    }

    request.instrumentOutgoingRequests({
      traceFetch,
      traceXHR,
      tracePropagationTargets,
      shouldCreateSpanForRequest,
    });
  }

  /** Create routing idle transaction. */
   _createRouteTransaction(context) {
    if (!this._getCurrentHub) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
        utils.logger.warn(`[Tracing] Did not create ${context.op} transaction because _getCurrentHub is invalid.`);
      return undefined;
    }

    const { beforeNavigate, idleTimeout, finalTimeout, heartbeatInterval } = this.options;

    const isPageloadTransaction = context.op === 'pageload';

    const sentryTraceMetaTagValue = isPageloadTransaction ? getMetaContent('sentry-trace') : null;
    const baggageMetaTagValue = isPageloadTransaction ? getMetaContent('baggage') : null;

    const traceParentData = sentryTraceMetaTagValue ? utils.extractTraceparentData(sentryTraceMetaTagValue) : undefined;
    const dynamicSamplingContext = baggageMetaTagValue
      ? utils.baggageHeaderToDynamicSamplingContext(baggageMetaTagValue)
      : undefined;

    const expandedContext = {
      ...context,
      ...traceParentData,
      metadata: {
        ...context.metadata,
        dynamicSamplingContext: traceParentData && !dynamicSamplingContext ? {} : dynamicSamplingContext,
      },
      trimEnd: true,
    };

    const modifiedContext = typeof beforeNavigate === 'function' ? beforeNavigate(expandedContext) : expandedContext;

    // For backwards compatibility reasons, beforeNavigate can return undefined to "drop" the transaction (prevent it
    // from being sent to Sentry).
    const finalContext = modifiedContext === undefined ? { ...expandedContext, sampled: false } : modifiedContext;

    // If `beforeNavigate` set a custom name, record that fact
    finalContext.metadata =
      finalContext.name !== expandedContext.name
        ? { ...finalContext.metadata, source: 'custom' }
        : finalContext.metadata;

    this._latestRouteName = finalContext.name;
    this._latestRouteSource = finalContext.metadata && finalContext.metadata.source;

    if (finalContext.sampled === false) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
        utils.logger.log(`[Tracing] Will not send ${finalContext.op} transaction because of beforeNavigate.`);
    }

    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`[Tracing] Starting ${finalContext.op} transaction on scope`);

    const hub = this._getCurrentHub();
    const { location } = types.WINDOW;

    const idleTransaction = hubextensions.startIdleTransaction(
      hub,
      finalContext,
      idleTimeout,
      finalTimeout,
      true,
      { location }, // for use in the tracesSampler
      heartbeatInterval,
    );
    idleTransaction.registerBeforeFinishCallback(transaction => {
      index.addPerformanceEntries(transaction);
    });

    return idleTransaction ;
  }

  /** Start listener for interaction transactions */
   _registerInteractionListener() {
    let inflightInteractionTransaction;
    const registerInteractionTransaction = () => {
      const { idleTimeout, finalTimeout, heartbeatInterval } = this.options;

      const op = 'ui.action.click';
      if (inflightInteractionTransaction) {
        inflightInteractionTransaction.finish();
        inflightInteractionTransaction = undefined;
      }

      if (!this._getCurrentHub) {
        (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn(`[Tracing] Did not create ${op} transaction because _getCurrentHub is invalid.`);
        return undefined;
      }

      if (!this._latestRouteName) {
        (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
          utils.logger.warn(`[Tracing] Did not create ${op} transaction because _latestRouteName is missing.`);
        return undefined;
      }

      const hub = this._getCurrentHub();
      const { location } = types.WINDOW;

      const context = {
        name: this._latestRouteName,
        op,
        trimEnd: true,
        metadata: {
          source: this._latestRouteSource || 'url',
        },
      };

      inflightInteractionTransaction = hubextensions.startIdleTransaction(
        hub,
        context,
        idleTimeout,
        finalTimeout,
        true,
        { location }, // for use in the tracesSampler
        heartbeatInterval,
      );
    };

    ['click'].forEach(type => {
      addEventListener(type, registerInteractionTransaction, { once: false, capture: true });
    });
  }
}

/** Returns the value of a meta tag */
function getMetaContent(metaName) {
  // Can't specify generic to `getDomElement` because tracing can be used
  // in a variety of environments, have to disable `no-unsafe-member-access`
  // as a result.
  const metaTag = utils.getDomElement(`meta[name=${metaName}]`);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return metaTag ? metaTag.getAttribute('content') : null;
}

exports.BROWSER_TRACING_INTEGRATION_ID = BROWSER_TRACING_INTEGRATION_ID;
exports.BrowserTracing = BrowserTracing;
exports.getMetaContent = getMetaContent;
//# sourceMappingURL=browsertracing.js.map


/***/ }),

/***/ 1480:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const utils$1 = __webpack_require__(562);
const types = __webpack_require__(5771);
const getCLS = __webpack_require__(3619);
const getFID = __webpack_require__(4425);
const getLCP = __webpack_require__(7516);
const getVisibilityWatcher = __webpack_require__(654);
const observe = __webpack_require__(9906);
const utils$2 = __webpack_require__(2692);

function getBrowserPerformanceAPI() {
  return types.WINDOW && types.WINDOW.addEventListener && types.WINDOW.performance;
}

let _performanceCursor = 0;

let _measurements = {};
let _lcpEntry;
let _clsEntry;

/**
 * Start tracking web vitals
 */
function startTrackingWebVitals() {
  const performance = getBrowserPerformanceAPI();
  if (performance && utils.browserPerformanceTimeOrigin) {
    if (performance.mark) {
      types.WINDOW.performance.mark('sentry-tracing-init');
    }
    _trackCLS();
    _trackLCP();
    _trackFID();
  }
}

/**
 * Start tracking long tasks.
 */
function startTrackingLongTasks() {
  const entryHandler = (entries) => {
    for (const entry of entries) {
      const transaction = utils$1.getActiveTransaction() ;
      if (!transaction) {
        return;
      }
      const startTime = utils$1.msToSec((utils.browserPerformanceTimeOrigin ) + entry.startTime);
      const duration = utils$1.msToSec(entry.duration);

      transaction.startChild({
        description: 'Main UI thread blocked',
        op: 'ui.long-task',
        startTimestamp: startTime,
        endTimestamp: startTime + duration,
      });
    }
  };

  observe.observe('longtask', entryHandler);
}

/** Starts tracking the Cumulative Layout Shift on the current page. */
function _trackCLS() {
  // See:
  // https://web.dev/evolving-cls/
  // https://web.dev/cls-web-tooling/
  getCLS.onCLS(metric => {
    const entry = metric.entries.pop();
    if (!entry) {
      return;
    }

    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Measurements] Adding CLS');
    _measurements['cls'] = { value: metric.value, unit: '' };
    _clsEntry = entry ;
  });
}

/** Starts tracking the Largest Contentful Paint on the current page. */
function _trackLCP() {
  getLCP.onLCP(metric => {
    const entry = metric.entries.pop();
    if (!entry) {
      return;
    }

    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Measurements] Adding LCP');
    _measurements['lcp'] = { value: metric.value, unit: 'millisecond' };
    _lcpEntry = entry ;
  });
}

/** Starts tracking the First Input Delay on the current page. */
function _trackFID() {
  getFID.onFID(metric => {
    const entry = metric.entries.pop();
    if (!entry) {
      return;
    }

    const timeOrigin = utils$1.msToSec(utils.browserPerformanceTimeOrigin );
    const startTime = utils$1.msToSec(entry.startTime);
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Measurements] Adding FID');
    _measurements['fid'] = { value: metric.value, unit: 'millisecond' };
    _measurements['mark.fid'] = { value: timeOrigin + startTime, unit: 'second' };
  });
}

/** Add performance related spans to a transaction */
function addPerformanceEntries(transaction) {
  const performance = getBrowserPerformanceAPI();
  if (!performance || !types.WINDOW.performance.getEntries || !utils.browserPerformanceTimeOrigin) {
    // Gatekeeper if performance API not available
    return;
  }

  (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Tracing] Adding & adjusting spans using Performance API');
  const timeOrigin = utils$1.msToSec(utils.browserPerformanceTimeOrigin);

  const performanceEntries = performance.getEntries();

  let responseStartTimestamp;
  let requestStartTimestamp;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performanceEntries.slice(_performanceCursor).forEach((entry) => {
    const startTime = utils$1.msToSec(entry.startTime);
    const duration = utils$1.msToSec(entry.duration);

    if (transaction.op === 'navigation' && timeOrigin + startTime < transaction.startTimestamp) {
      return;
    }

    switch (entry.entryType) {
      case 'navigation': {
        _addNavigationSpans(transaction, entry, timeOrigin);
        responseStartTimestamp = timeOrigin + utils$1.msToSec(entry.responseStart);
        requestStartTimestamp = timeOrigin + utils$1.msToSec(entry.requestStart);
        break;
      }
      case 'mark':
      case 'paint':
      case 'measure': {
        _addMeasureSpans(transaction, entry, startTime, duration, timeOrigin);

        // capture web vitals
        const firstHidden = getVisibilityWatcher.getVisibilityWatcher();
        // Only report if the page wasn't hidden prior to the web vital.
        const shouldRecord = entry.startTime < firstHidden.firstHiddenTime;

        if (entry.name === 'first-paint' && shouldRecord) {
          (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Measurements] Adding FP');
          _measurements['fp'] = { value: entry.startTime, unit: 'millisecond' };
        }
        if (entry.name === 'first-contentful-paint' && shouldRecord) {
          (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Measurements] Adding FCP');
          _measurements['fcp'] = { value: entry.startTime, unit: 'millisecond' };
        }
        break;
      }
      case 'resource': {
        const resourceName = (entry.name ).replace(types.WINDOW.location.origin, '');
        _addResourceSpans(transaction, entry, resourceName, startTime, duration, timeOrigin);
        break;
      }
      // Ignore other entry types.
    }
  });

  _performanceCursor = Math.max(performanceEntries.length - 1, 0);

  _trackNavigator(transaction);

  // Measurements are only available for pageload transactions
  if (transaction.op === 'pageload') {
    // Generate TTFB (Time to First Byte), which measured as the time between the beginning of the transaction and the
    // start of the response in milliseconds
    if (typeof responseStartTimestamp === 'number') {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Measurements] Adding TTFB');
      _measurements['ttfb'] = {
        value: (responseStartTimestamp - transaction.startTimestamp) * 1000,
        unit: 'millisecond',
      };

      if (typeof requestStartTimestamp === 'number' && requestStartTimestamp <= responseStartTimestamp) {
        // Capture the time spent making the request and receiving the first byte of the response.
        // This is the time between the start of the request and the start of the response in milliseconds.
        _measurements['ttfb.requestTime'] = {
          value: (responseStartTimestamp - requestStartTimestamp) * 1000,
          unit: 'millisecond',
        };
      }
    }

    ['fcp', 'fp', 'lcp'].forEach(name => {
      if (!_measurements[name] || timeOrigin >= transaction.startTimestamp) {
        return;
      }
      // The web vitals, fcp, fp, lcp, and ttfb, all measure relative to timeOrigin.
      // Unfortunately, timeOrigin is not captured within the transaction span data, so these web vitals will need
      // to be adjusted to be relative to transaction.startTimestamp.
      const oldValue = _measurements[name].value;
      const measurementTimestamp = timeOrigin + utils$1.msToSec(oldValue);

      // normalizedValue should be in milliseconds
      const normalizedValue = Math.abs((measurementTimestamp - transaction.startTimestamp) * 1000);
      const delta = normalizedValue - oldValue;

      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
        utils.logger.log(`[Measurements] Normalized ${name} from ${oldValue} to ${normalizedValue} (${delta})`);
      _measurements[name].value = normalizedValue;
    });

    const fidMark = _measurements['mark.fid'];
    if (fidMark && _measurements['fid']) {
      // create span for FID
      utils$2._startChild(transaction, {
        description: 'first input delay',
        endTimestamp: fidMark.value + utils$1.msToSec(_measurements['fid'].value),
        op: 'ui.action',
        startTimestamp: fidMark.value,
      });

      // Delete mark.fid as we don't want it to be part of final payload
      delete _measurements['mark.fid'];
    }

    // If FCP is not recorded we should not record the cls value
    // according to the new definition of CLS.
    if (!('fcp' in _measurements)) {
      delete _measurements.cls;
    }

    Object.keys(_measurements).forEach(measurementName => {
      transaction.setMeasurement(
        measurementName,
        _measurements[measurementName].value,
        _measurements[measurementName].unit,
      );
    });

    _tagMetricInfo(transaction);
  }

  _lcpEntry = undefined;
  _clsEntry = undefined;
  _measurements = {};
}

/** Create measure related spans */
function _addMeasureSpans(
  transaction,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entry,
  startTime,
  duration,
  timeOrigin,
) {
  const measureStartTimestamp = timeOrigin + startTime;
  const measureEndTimestamp = measureStartTimestamp + duration;

  utils$2._startChild(transaction, {
    description: entry.name ,
    endTimestamp: measureEndTimestamp,
    op: entry.entryType ,
    startTimestamp: measureStartTimestamp,
  });

  return measureStartTimestamp;
}

/** Instrument navigation entries */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _addNavigationSpans(transaction, entry, timeOrigin) {
  ['unloadEvent', 'redirect', 'domContentLoadedEvent', 'loadEvent', 'connect'].forEach(event => {
    _addPerformanceNavigationTiming(transaction, entry, event, timeOrigin);
  });
  _addPerformanceNavigationTiming(transaction, entry, 'secureConnection', timeOrigin, 'TLS/SSL', 'connectEnd');
  _addPerformanceNavigationTiming(transaction, entry, 'fetch', timeOrigin, 'cache', 'domainLookupStart');
  _addPerformanceNavigationTiming(transaction, entry, 'domainLookup', timeOrigin, 'DNS');
  _addRequest(transaction, entry, timeOrigin);
}

/** Create performance navigation related spans */
function _addPerformanceNavigationTiming(
  transaction,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entry,
  event,
  timeOrigin,
  description,
  eventEnd,
) {
  const end = eventEnd ? (entry[eventEnd] ) : (entry[`${event}End`] );
  const start = entry[`${event}Start`] ;
  if (!start || !end) {
    return;
  }
  utils$2._startChild(transaction, {
    op: 'browser',
    description: description || event,
    startTimestamp: timeOrigin + utils$1.msToSec(start),
    endTimestamp: timeOrigin + utils$1.msToSec(end),
  });
}

/** Create request and response related spans */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _addRequest(transaction, entry, timeOrigin) {
  utils$2._startChild(transaction, {
    op: 'browser',
    description: 'request',
    startTimestamp: timeOrigin + utils$1.msToSec(entry.requestStart ),
    endTimestamp: timeOrigin + utils$1.msToSec(entry.responseEnd ),
  });

  utils$2._startChild(transaction, {
    op: 'browser',
    description: 'response',
    startTimestamp: timeOrigin + utils$1.msToSec(entry.responseStart ),
    endTimestamp: timeOrigin + utils$1.msToSec(entry.responseEnd ),
  });
}

/** Create resource-related spans */
function _addResourceSpans(
  transaction,
  entry,
  resourceName,
  startTime,
  duration,
  timeOrigin,
) {
  // we already instrument based on fetch and xhr, so we don't need to
  // duplicate spans here.
  if (entry.initiatorType === 'xmlhttprequest' || entry.initiatorType === 'fetch') {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = {};
  if ('transferSize' in entry) {
    data['Transfer Size'] = entry.transferSize;
  }
  if ('encodedBodySize' in entry) {
    data['Encoded Body Size'] = entry.encodedBodySize;
  }
  if ('decodedBodySize' in entry) {
    data['Decoded Body Size'] = entry.decodedBodySize;
  }

  const startTimestamp = timeOrigin + startTime;
  const endTimestamp = startTimestamp + duration;

  utils$2._startChild(transaction, {
    description: resourceName,
    endTimestamp,
    op: entry.initiatorType ? `resource.${entry.initiatorType}` : 'resource.other',
    startTimestamp,
    data,
  });
}

/**
 * Capture the information of the user agent.
 */
function _trackNavigator(transaction) {
  const navigator = types.WINDOW.navigator ;
  if (!navigator) {
    return;
  }

  // track network connectivity
  const connection = navigator.connection;
  if (connection) {
    if (connection.effectiveType) {
      transaction.setTag('effectiveConnectionType', connection.effectiveType);
    }

    if (connection.type) {
      transaction.setTag('connectionType', connection.type);
    }

    if (utils$2.isMeasurementValue(connection.rtt)) {
      _measurements['connection.rtt'] = { value: connection.rtt, unit: 'millisecond' };
    }
  }

  if (utils$2.isMeasurementValue(navigator.deviceMemory)) {
    transaction.setTag('deviceMemory', `${navigator.deviceMemory} GB`);
  }

  if (utils$2.isMeasurementValue(navigator.hardwareConcurrency)) {
    transaction.setTag('hardwareConcurrency', String(navigator.hardwareConcurrency));
  }
}

/** Add LCP / CLS data to transaction to allow debugging */
function _tagMetricInfo(transaction) {
  if (_lcpEntry) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Measurements] Adding LCP Data');

    // Capture Properties of the LCP element that contributes to the LCP.

    if (_lcpEntry.element) {
      transaction.setTag('lcp.element', utils.htmlTreeAsString(_lcpEntry.element));
    }

    if (_lcpEntry.id) {
      transaction.setTag('lcp.id', _lcpEntry.id);
    }

    if (_lcpEntry.url) {
      // Trim URL to the first 200 characters.
      transaction.setTag('lcp.url', _lcpEntry.url.trim().slice(0, 200));
    }

    transaction.setTag('lcp.size', _lcpEntry.size);
  }

  // See: https://developer.mozilla.org/en-US/docs/Web/API/LayoutShift
  if (_clsEntry && _clsEntry.sources) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Measurements] Adding CLS Data');
    _clsEntry.sources.forEach((source, index) =>
      transaction.setTag(`cls.source.${index + 1}`, utils.htmlTreeAsString(source.node)),
    );
  }
}

exports._addMeasureSpans = _addMeasureSpans;
exports._addResourceSpans = _addResourceSpans;
exports.addPerformanceEntries = addPerformanceEntries;
exports.startTrackingLongTasks = startTrackingLongTasks;
exports.startTrackingWebVitals = startTrackingWebVitals;
//# sourceMappingURL=index.js.map


/***/ }),

/***/ 2692:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Checks if a given value is a valid measurement value.
 */
function isMeasurementValue(value) {
  return typeof value === 'number' && isFinite(value);
}

/**
 * Helper function to start child on transactions. This function will make sure that the transaction will
 * use the start timestamp of the created child span if it is earlier than the transactions actual
 * start timestamp.
 */
function _startChild(transaction, { startTimestamp, ...ctx }) {
  if (startTimestamp && transaction.startTimestamp > startTimestamp) {
    transaction.startTimestamp = startTimestamp;
  }

  return transaction.startChild({
    startTimestamp,
    ...ctx,
  });
}

exports._startChild = _startChild;
exports.isMeasurementValue = isMeasurementValue;
//# sourceMappingURL=utils.js.map


/***/ }),

/***/ 5592:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const utils$1 = __webpack_require__(562);

/* eslint-disable max-lines */

const DEFAULT_TRACE_PROPAGATION_TARGETS = ['localhost', /^\//];

/** Options for Request Instrumentation */

const defaultRequestInstrumentationOptions = {
  traceFetch: true,
  traceXHR: true,
  // TODO (v8): Remove this property
  tracingOrigins: DEFAULT_TRACE_PROPAGATION_TARGETS,
  tracePropagationTargets: DEFAULT_TRACE_PROPAGATION_TARGETS,
};

/** Registers span creators for xhr and fetch requests  */
function instrumentOutgoingRequests(_options) {
  // eslint-disable-next-line deprecation/deprecation
  const { traceFetch, traceXHR, tracePropagationTargets, tracingOrigins, shouldCreateSpanForRequest } = {
    traceFetch: defaultRequestInstrumentationOptions.traceFetch,
    traceXHR: defaultRequestInstrumentationOptions.traceXHR,
    ..._options,
  };

  const shouldCreateSpan =
    typeof shouldCreateSpanForRequest === 'function' ? shouldCreateSpanForRequest : (_) => true;

  // TODO(v8) Remove tracingOrigins here
  // The only reason we're passing it in here is because this instrumentOutgoingRequests function is publicly exported
  // and we don't want to break the API. We can remove it in v8.
  const shouldAttachHeadersWithTargets = (url) =>
    shouldAttachHeaders(url, tracePropagationTargets || tracingOrigins);

  const spans = {};

  if (traceFetch) {
    utils.addInstrumentationHandler('fetch', (handlerData) => {
      fetchCallback(handlerData, shouldCreateSpan, shouldAttachHeadersWithTargets, spans);
    });
  }

  if (traceXHR) {
    utils.addInstrumentationHandler('xhr', (handlerData) => {
      xhrCallback(handlerData, shouldCreateSpan, shouldAttachHeadersWithTargets, spans);
    });
  }
}

/**
 * A function that determines whether to attach tracing headers to a request.
 * This was extracted from `instrumentOutgoingRequests` to make it easier to test shouldAttachHeaders.
 * We only export this fuction for testing purposes.
 */
function shouldAttachHeaders(url, tracePropagationTargets) {
  return utils.stringMatchesSomePattern(url, tracePropagationTargets || DEFAULT_TRACE_PROPAGATION_TARGETS);
}

/**
 * Create and track fetch request spans
 */
function fetchCallback(
  handlerData,
  shouldCreateSpan,
  shouldAttachHeaders,
  spans,
) {
  if (!utils$1.hasTracingEnabled() || !(handlerData.fetchData && shouldCreateSpan(handlerData.fetchData.url))) {
    return;
  }

  if (handlerData.endTimestamp) {
    const spanId = handlerData.fetchData.__span;
    if (!spanId) return;

    const span = spans[spanId];
    if (span) {
      if (handlerData.response) {
        // TODO (kmclb) remove this once types PR goes through
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        span.setHttpStatus(handlerData.response.status);
      } else if (handlerData.error) {
        span.setStatus('internal_error');
      }
      span.finish();

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete spans[spanId];
    }
    return;
  }

  const currentScope = core.getCurrentHub().getScope();
  const currentSpan = currentScope && currentScope.getSpan();
  const activeTransaction = currentSpan && currentSpan.transaction;

  if (currentSpan && activeTransaction) {
    const span = currentSpan.startChild({
      data: {
        ...handlerData.fetchData,
        type: 'fetch',
      },
      description: `${handlerData.fetchData.method} ${handlerData.fetchData.url}`,
      op: 'http.client',
    });

    handlerData.fetchData.__span = span.spanId;
    spans[span.spanId] = span;

    const request = handlerData.args[0];

    // In case the user hasn't set the second argument of a fetch call we default it to `{}`.
    handlerData.args[1] = handlerData.args[1] || {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = handlerData.args[1];

    if (shouldAttachHeaders(handlerData.fetchData.url)) {
      options.headers = addTracingHeadersToFetchRequest(
        request,
        activeTransaction.getDynamicSamplingContext(),
        span,
        options,
      );

      activeTransaction.metadata.propagations++;
    }
  }
}

function addTracingHeadersToFetchRequest(
  request,
  dynamicSamplingContext,
  span,
  options

,
) {
  const sentryBaggageHeader = utils.dynamicSamplingContextToSentryBaggageHeader(dynamicSamplingContext);
  const sentryTraceHeader = span.toTraceparent();

  const headers =
    typeof Request !== 'undefined' && utils.isInstanceOf(request, Request) ? (request ).headers : options.headers;

  if (!headers) {
    return { 'sentry-trace': sentryTraceHeader, baggage: sentryBaggageHeader };
  } else if (typeof Headers !== 'undefined' && utils.isInstanceOf(headers, Headers)) {
    const newHeaders = new Headers(headers );

    newHeaders.append('sentry-trace', sentryTraceHeader);

    if (sentryBaggageHeader) {
      // If the same header is appended miultiple times the browser will merge the values into a single request header.
      // Its therefore safe to simply push a "baggage" entry, even though there might already be another baggage header.
      newHeaders.append(utils.BAGGAGE_HEADER_NAME, sentryBaggageHeader);
    }

    return newHeaders ;
  } else if (Array.isArray(headers)) {
    const newHeaders = [...headers, ['sentry-trace', sentryTraceHeader]];

    if (sentryBaggageHeader) {
      // If there are multiple entries with the same key, the browser will merge the values into a single request header.
      // Its therefore safe to simply push a "baggage" entry, even though there might already be another baggage header.
      newHeaders.push([utils.BAGGAGE_HEADER_NAME, sentryBaggageHeader]);
    }

    return newHeaders;
  } else {
    const existingBaggageHeader = 'baggage' in headers ? headers.baggage : undefined;
    const newBaggageHeaders = [];

    if (Array.isArray(existingBaggageHeader)) {
      newBaggageHeaders.push(...existingBaggageHeader);
    } else if (existingBaggageHeader) {
      newBaggageHeaders.push(existingBaggageHeader);
    }

    if (sentryBaggageHeader) {
      newBaggageHeaders.push(sentryBaggageHeader);
    }

    return {
      ...(headers ),
      'sentry-trace': sentryTraceHeader,
      baggage: newBaggageHeaders.length > 0 ? newBaggageHeaders.join(',') : undefined,
    };
  }
}

/**
 * Create and track xhr request spans
 */
function xhrCallback(
  handlerData,
  shouldCreateSpan,
  shouldAttachHeaders,
  spans,
) {
  if (
    !utils$1.hasTracingEnabled() ||
    (handlerData.xhr && handlerData.xhr.__sentry_own_request__) ||
    !(handlerData.xhr && handlerData.xhr.__sentry_xhr__ && shouldCreateSpan(handlerData.xhr.__sentry_xhr__.url))
  ) {
    return;
  }

  const xhr = handlerData.xhr.__sentry_xhr__;

  // check first if the request has finished and is tracked by an existing span which should now end
  if (handlerData.endTimestamp) {
    const spanId = handlerData.xhr.__sentry_xhr_span_id__;
    if (!spanId) return;

    const span = spans[spanId];
    if (span) {
      span.setHttpStatus(xhr.status_code);
      span.finish();

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete spans[spanId];
    }
    return;
  }

  const currentScope = core.getCurrentHub().getScope();
  const currentSpan = currentScope && currentScope.getSpan();
  const activeTransaction = currentSpan && currentSpan.transaction;

  if (currentSpan && activeTransaction) {
    const span = currentSpan.startChild({
      data: {
        ...xhr.data,
        type: 'xhr',
        method: xhr.method,
        url: xhr.url,
      },
      description: `${xhr.method} ${xhr.url}`,
      op: 'http.client',
    });

    handlerData.xhr.__sentry_xhr_span_id__ = span.spanId;
    spans[handlerData.xhr.__sentry_xhr_span_id__] = span;

    if (handlerData.xhr.setRequestHeader && shouldAttachHeaders(handlerData.xhr.__sentry_xhr__.url)) {
      try {
        handlerData.xhr.setRequestHeader('sentry-trace', span.toTraceparent());

        const dynamicSamplingContext = activeTransaction.getDynamicSamplingContext();
        const sentryBaggageHeader = utils.dynamicSamplingContextToSentryBaggageHeader(dynamicSamplingContext);

        if (sentryBaggageHeader) {
          // From MDN: "If this method is called several times with the same header, the values are merged into one single request header."
          // We can therefore simply set a baggage header without checking what was there before
          // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/setRequestHeader
          handlerData.xhr.setRequestHeader(utils.BAGGAGE_HEADER_NAME, sentryBaggageHeader);
        }

        activeTransaction.metadata.propagations++;
      } catch (_) {
        // Error: InvalidStateError: Failed to execute 'setRequestHeader' on 'XMLHttpRequest': The object's state must be OPENED.
      }
    }
  }
}

exports.DEFAULT_TRACE_PROPAGATION_TARGETS = DEFAULT_TRACE_PROPAGATION_TARGETS;
exports.defaultRequestInstrumentationOptions = defaultRequestInstrumentationOptions;
exports.fetchCallback = fetchCallback;
exports.instrumentOutgoingRequests = instrumentOutgoingRequests;
exports.shouldAttachHeaders = shouldAttachHeaders;
exports.xhrCallback = xhrCallback;
//# sourceMappingURL=request.js.map


/***/ }),

/***/ 9554:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const types = __webpack_require__(5771);

/**
 * Default function implementing pageload and navigation transactions
 */
function instrumentRoutingWithDefaults(
  customStartTransaction,
  startTransactionOnPageLoad = true,
  startTransactionOnLocationChange = true,
) {
  if (!types.WINDOW || !types.WINDOW.location) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('Could not initialize routing instrumentation due to invalid location');
    return;
  }

  let startingUrl = types.WINDOW.location.href;

  let activeTransaction;
  if (startTransactionOnPageLoad) {
    activeTransaction = customStartTransaction({
      name: types.WINDOW.location.pathname,
      op: 'pageload',
      metadata: { source: 'url' },
    });
  }

  if (startTransactionOnLocationChange) {
    utils.addInstrumentationHandler('history', ({ to, from }) => {
      /**
       * This early return is there to account for some cases where a navigation transaction starts right after
       * long-running pageload. We make sure that if `from` is undefined and a valid `startingURL` exists, we don't
       * create an uneccessary navigation transaction.
       *
       * This was hard to duplicate, but this behavior stopped as soon as this fix was applied. This issue might also
       * only be caused in certain development environments where the usage of a hot module reloader is causing
       * errors.
       */
      if (from === undefined && startingUrl && startingUrl.indexOf(to) !== -1) {
        startingUrl = undefined;
        return;
      }

      if (from !== to) {
        startingUrl = undefined;
        if (activeTransaction) {
          (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`[Tracing] Finishing current transaction with op: ${activeTransaction.op}`);
          // If there's an open transaction on the scope, we need to finish it before creating an new one.
          activeTransaction.finish();
        }
        activeTransaction = customStartTransaction({
          name: types.WINDOW.location.pathname,
          op: 'navigation',
          metadata: { source: 'url' },
        });
      }
    });
  }
}

exports.instrumentRoutingWithDefaults = instrumentRoutingWithDefaults;
//# sourceMappingURL=router.js.map


/***/ }),

/***/ 5771:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

const WINDOW = utils.GLOBAL_OBJ ;

exports.WINDOW = WINDOW;
//# sourceMappingURL=types.js.map


/***/ }),

/***/ 3619:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const bindReporter = __webpack_require__(9932);
const initMetric = __webpack_require__(6984);
const observe = __webpack_require__(9906);
const onHidden = __webpack_require__(3843);

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Calculates the [CLS](https://web.dev/cls/) value for the current page and
 * calls the `callback` function once the value is ready to be reported, along
 * with all `layout-shift` performance entries that were used in the metric
 * value calculation. The reported value is a `double` (corresponding to a
 * [layout shift score](https://web.dev/cls/#layout-shift-score)).
 *
 * If the `reportAllChanges` configuration option is set to `true`, the
 * `callback` function will be called as soon as the value is initially
 * determined as well as any time the value changes throughout the page
 * lifespan.
 *
 * _**Important:** CLS should be continually monitored for changes throughout
 * the entire lifespan of a page—including if the user returns to the page after
 * it's been hidden/backgrounded. However, since browsers often [will not fire
 * additional callbacks once the user has backgrounded a
 * page](https://developer.chrome.com/blog/page-lifecycle-api/#advice-hidden),
 * `callback` is always called when the page's visibility state changes to
 * hidden. As a result, the `callback` function might be called multiple times
 * during the same page load._
 */
const onCLS = (onReport) => {
  const metric = initMetric.initMetric('CLS', 0);
  let report;

  let sessionValue = 0;
  let sessionEntries = [];

  // const handleEntries = (entries: Metric['entries']) => {
  const handleEntries = (entries) => {
    entries.forEach(entry => {
      // Only count layout shifts without recent user input.
      if (!entry.hadRecentInput) {
        const firstSessionEntry = sessionEntries[0];
        const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

        // If the entry occurred less than 1 second after the previous entry and
        // less than 5 seconds after the first entry in the session, include the
        // entry in the current session. Otherwise, start a new session.
        if (
          sessionValue &&
          sessionEntries.length !== 0 &&
          entry.startTime - lastSessionEntry.startTime < 1000 &&
          entry.startTime - firstSessionEntry.startTime < 5000
        ) {
          sessionValue += entry.value;
          sessionEntries.push(entry);
        } else {
          sessionValue = entry.value;
          sessionEntries = [entry];
        }

        // If the current session value is larger than the current CLS value,
        // update CLS and the entries contributing to it.
        if (sessionValue > metric.value) {
          metric.value = sessionValue;
          metric.entries = sessionEntries;
          if (report) {
            report();
          }
        }
      }
    });
  };

  const po = observe.observe('layout-shift', handleEntries);
  if (po) {
    report = bindReporter.bindReporter(onReport, metric);

    onHidden.onHidden(() => {
      handleEntries(po.takeRecords() );
      report(true);
    });
  }
};

exports.onCLS = onCLS;
//# sourceMappingURL=getCLS.js.map


/***/ }),

/***/ 4425:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const bindReporter = __webpack_require__(9932);
const getVisibilityWatcher = __webpack_require__(654);
const initMetric = __webpack_require__(6984);
const observe = __webpack_require__(9906);
const onHidden = __webpack_require__(3843);

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Calculates the [FID](https://web.dev/fid/) value for the current page and
 * calls the `callback` function once the value is ready, along with the
 * relevant `first-input` performance entry used to determine the value. The
 * reported value is a `DOMHighResTimeStamp`.
 *
 * _**Important:** since FID is only reported after the user interacts with the
 * page, it's possible that it will not be reported for some page loads._
 */
const onFID = (onReport) => {
  const visibilityWatcher = getVisibilityWatcher.getVisibilityWatcher();
  const metric = initMetric.initMetric('FID');
  // eslint-disable-next-line prefer-const
  let report;

  const handleEntry = (entry) => {
    // Only report if the page wasn't hidden prior to the first input.
    if (entry.startTime < visibilityWatcher.firstHiddenTime) {
      metric.value = entry.processingStart - entry.startTime;
      metric.entries.push(entry);
      report(true);
    }
  };

  const handleEntries = (entries) => {
    (entries ).forEach(handleEntry);
  };

  const po = observe.observe('first-input', handleEntries);
  report = bindReporter.bindReporter(onReport, metric);

  if (po) {
    onHidden.onHidden(() => {
      handleEntries(po.takeRecords() );
      po.disconnect();
    }, true);
  }
};

exports.onFID = onFID;
//# sourceMappingURL=getFID.js.map


/***/ }),

/***/ 7516:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const bindReporter = __webpack_require__(9932);
const getActivationStart = __webpack_require__(4629);
const getVisibilityWatcher = __webpack_require__(654);
const initMetric = __webpack_require__(6984);
const observe = __webpack_require__(9906);
const onHidden = __webpack_require__(3843);

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const reportedMetricIDs = {};

/**
 * Calculates the [LCP](https://web.dev/lcp/) value for the current page and
 * calls the `callback` function once the value is ready (along with the
 * relevant `largest-contentful-paint` performance entry used to determine the
 * value). The reported value is a `DOMHighResTimeStamp`.
 */
const onLCP = (onReport) => {
  const visibilityWatcher = getVisibilityWatcher.getVisibilityWatcher();
  const metric = initMetric.initMetric('LCP');
  let report;

  const handleEntries = (entries) => {
    const lastEntry = entries[entries.length - 1] ;
    if (lastEntry) {
      // The startTime attribute returns the value of the renderTime if it is
      // not 0, and the value of the loadTime otherwise. The activationStart
      // reference is used because LCP should be relative to page activation
      // rather than navigation start if the page was prerendered.
      const value = Math.max(lastEntry.startTime - getActivationStart.getActivationStart(), 0);

      // Only report if the page wasn't hidden prior to LCP.
      if (value < visibilityWatcher.firstHiddenTime) {
        metric.value = value;
        metric.entries = [lastEntry];
        report();
      }
    }
  };

  const po = observe.observe('largest-contentful-paint', handleEntries);

  if (po) {
    report = bindReporter.bindReporter(onReport, metric);

    const stopListening = () => {
      if (!reportedMetricIDs[metric.id]) {
        handleEntries(po.takeRecords() );
        po.disconnect();
        reportedMetricIDs[metric.id] = true;
        report(true);
      }
    };

    // Stop listening after input. Note: while scrolling is an input that
    // stop LCP observation, it's unreliable since it can be programmatically
    // generated. See: https://github.com/GoogleChrome/web-vitals/issues/75
    ['keydown', 'click'].forEach(type => {
      addEventListener(type, stopListening, { once: true, capture: true });
    });

    onHidden.onHidden(stopListening, true);
  }
};

exports.onLCP = onLCP;
//# sourceMappingURL=getLCP.js.map


/***/ }),

/***/ 9932:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const bindReporter = (
  callback,
  metric,
  reportAllChanges,
) => {
  let prevValue;
  let delta;
  return (forceReport) => {
    if (metric.value >= 0) {
      if (forceReport || reportAllChanges) {
        delta = metric.value - (prevValue || 0);

        // Report the metric if there's a non-zero delta or if no previous
        // value exists (which can happen in the case of the document becoming
        // hidden when the metric value is 0).
        // See: https://github.com/GoogleChrome/web-vitals/issues/14
        if (delta || prevValue === undefined) {
          prevValue = metric.value;
          metric.delta = delta;
          callback(metric);
        }
      }
    }
  };
};

exports.bindReporter = bindReporter;
//# sourceMappingURL=bindReporter.js.map


/***/ }),

/***/ 2412:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Performantly generate a unique, 30-char string by combining a version
 * number, the current timestamp with a 13-digit number integer.
 * @return {string}
 */
const generateUniqueID = () => {
  return `v3-${Date.now()}-${Math.floor(Math.random() * (9e12 - 1)) + 1e12}`;
};

exports.generateUniqueID = generateUniqueID;
//# sourceMappingURL=generateUniqueID.js.map


/***/ }),

/***/ 4629:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const getNavigationEntry = __webpack_require__(2902);

/*
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const getActivationStart = () => {
  const navEntry = getNavigationEntry.getNavigationEntry();
  return (navEntry && navEntry.activationStart) || 0;
};

exports.getActivationStart = getActivationStart;
//# sourceMappingURL=getActivationStart.js.map


/***/ }),

/***/ 2902:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const types = __webpack_require__(5771);

/*
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const getNavigationEntryFromPerformanceTiming = () => {
  // eslint-disable-next-line deprecation/deprecation
  const timing = types.WINDOW.performance.timing;
  // eslint-disable-next-line deprecation/deprecation
  const type = types.WINDOW.performance.navigation.type;

  const navigationEntry = {
    entryType: 'navigation',
    startTime: 0,
    type: type == 2 ? 'back_forward' : type === 1 ? 'reload' : 'navigate',
  };

  for (const key in timing) {
    if (key !== 'navigationStart' && key !== 'toJSON') {
      navigationEntry[key] = Math.max((timing[key ] ) - timing.navigationStart, 0);
    }
  }
  return navigationEntry ;
};

const getNavigationEntry = () => {
  if (types.WINDOW.__WEB_VITALS_POLYFILL__) {
    return (
      types.WINDOW.performance &&
      ((performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) ||
        getNavigationEntryFromPerformanceTiming())
    );
  } else {
    return types.WINDOW.performance && performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  }
};

exports.getNavigationEntry = getNavigationEntry;
//# sourceMappingURL=getNavigationEntry.js.map


/***/ }),

/***/ 654:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const types = __webpack_require__(5771);
const onHidden = __webpack_require__(3843);

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

let firstHiddenTime = -1;

const initHiddenTime = () => {
  // If the document is hidden and not prerendering, assume it was always
  // hidden and the page was loaded in the background.
  return types.WINDOW.document.visibilityState === 'hidden' && !types.WINDOW.document.prerendering ? 0 : Infinity;
};

const trackChanges = () => {
  // Update the time if/when the document becomes hidden.
  onHidden.onHidden(({ timeStamp }) => {
    firstHiddenTime = timeStamp;
  }, true);
};

const getVisibilityWatcher = (

) => {
  if (firstHiddenTime < 0) {
    // If the document is hidden when this code runs, assume it was hidden
    // since navigation start. This isn't a perfect heuristic, but it's the
    // best we can do until an API is available to support querying past
    // visibilityState.
    firstHiddenTime = initHiddenTime();
    trackChanges();
  }
  return {
    get firstHiddenTime() {
      return firstHiddenTime;
    },
  };
};

exports.getVisibilityWatcher = getVisibilityWatcher;
//# sourceMappingURL=getVisibilityWatcher.js.map


/***/ }),

/***/ 6984:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const types = __webpack_require__(5771);
const generateUniqueID = __webpack_require__(2412);
const getActivationStart = __webpack_require__(4629);
const getNavigationEntry = __webpack_require__(2902);

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const initMetric = (name, value) => {
  const navEntry = getNavigationEntry.getNavigationEntry();
  let navigationType = 'navigate';

  if (navEntry) {
    if (types.WINDOW.document.prerendering || getActivationStart.getActivationStart() > 0) {
      navigationType = 'prerender';
    } else {
      navigationType = navEntry.type.replace(/_/g, '-') ;
    }
  }

  return {
    name,
    value: typeof value === 'undefined' ? -1 : value,
    rating: 'good', // Will be updated if the value changes.
    delta: 0,
    entries: [],
    id: generateUniqueID.generateUniqueID(),
    navigationType,
  };
};

exports.initMetric = initMetric;
//# sourceMappingURL=initMetric.js.map


/***/ }),

/***/ 9906:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Takes a performance entry type and a callback function, and creates a
 * `PerformanceObserver` instance that will observe the specified entry type
 * with buffering enabled and call the callback _for each entry_.
 *
 * This function also feature-detects entry support and wraps the logic in a
 * try/catch to avoid errors in unsupporting browsers.
 */
const observe = (
  type,
  callback,
  opts,
) => {
  try {
    if (PerformanceObserver.supportedEntryTypes.includes(type)) {
      const po = new PerformanceObserver(list => {
        callback(list.getEntries() );
      });
      po.observe(
        Object.assign(
          {
            type,
            buffered: true,
          },
          opts || {},
        ) ,
      );
      return po;
    }
  } catch (e) {
    // Do nothing.
  }
  return;
};

exports.observe = observe;
//# sourceMappingURL=observe.js.map


/***/ }),

/***/ 3843:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const types = __webpack_require__(5771);

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const onHidden = (cb, once) => {
  const onHiddenOrPageHide = (event) => {
    if (event.type === 'pagehide' || types.WINDOW.document.visibilityState === 'hidden') {
      cb(event);
      if (once) {
        removeEventListener('visibilitychange', onHiddenOrPageHide, true);
        removeEventListener('pagehide', onHiddenOrPageHide, true);
      }
    }
  };
  addEventListener('visibilitychange', onHiddenOrPageHide, true);
  // Some browsers have buggy implementations of visibilitychange,
  // so we use pagehide in addition, just to be safe.
  addEventListener('pagehide', onHiddenOrPageHide, true);
};

exports.onHidden = onHidden;
//# sourceMappingURL=onHidden.js.map


/***/ }),

/***/ 1037:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const utils$1 = __webpack_require__(562);

/**
 * Configures global error listeners
 */
function registerErrorInstrumentation() {
  utils.addInstrumentationHandler('error', errorCallback);
  utils.addInstrumentationHandler('unhandledrejection', errorCallback);
}

/**
 * If an error or unhandled promise occurs, we mark the active transaction as failed
 */
function errorCallback() {
  const activeTransaction = utils$1.getActiveTransaction();
  if (activeTransaction) {
    const status = 'internal_error';
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`[Tracing] Transaction: ${status} -> Global error occured`);
    activeTransaction.setStatus(status);
  }
}

exports.registerErrorInstrumentation = registerErrorInstrumentation;
//# sourceMappingURL=errors.js.map


/***/ }),

/***/ 6411:
/***/ ((module, exports, __webpack_require__) => {

/* module decorator */ module = __webpack_require__.nmd(module);
Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const errors = __webpack_require__(1037);
const idletransaction = __webpack_require__(5795);
const transaction = __webpack_require__(7738);
const utils$1 = __webpack_require__(562);

/** Returns all trace headers that are currently on the top scope. */
function traceHeaders() {
  const scope = this.getScope();
  if (scope) {
    const span = scope.getSpan();
    if (span) {
      return {
        'sentry-trace': span.toTraceparent(),
      };
    }
  }
  return {};
}

/**
 * Makes a sampling decision for the given transaction and stores it on the transaction.
 *
 * Called every time a transaction is created. Only transactions which emerge with a `sampled` value of `true` will be
 * sent to Sentry.
 *
 * @param transaction: The transaction needing a sampling decision
 * @param options: The current client's options, so we can access `tracesSampleRate` and/or `tracesSampler`
 * @param samplingContext: Default and user-provided data which may be used to help make the decision
 *
 * @returns The given transaction with its `sampled` value set
 */
function sample(
  transaction,
  options,
  samplingContext,
) {
  // nothing to do if tracing is not enabled
  if (!utils$1.hasTracingEnabled(options)) {
    transaction.sampled = false;
    return transaction;
  }

  // if the user has forced a sampling decision by passing a `sampled` value in their transaction context, go with that
  if (transaction.sampled !== undefined) {
    transaction.setMetadata({
      sampleRate: Number(transaction.sampled),
    });
    return transaction;
  }

  // we would have bailed already if neither `tracesSampler` nor `tracesSampleRate` were defined, so one of these should
  // work; prefer the hook if so
  let sampleRate;
  if (typeof options.tracesSampler === 'function') {
    sampleRate = options.tracesSampler(samplingContext);
    transaction.setMetadata({
      sampleRate: Number(sampleRate),
    });
  } else if (samplingContext.parentSampled !== undefined) {
    sampleRate = samplingContext.parentSampled;
  } else {
    sampleRate = options.tracesSampleRate;
    transaction.setMetadata({
      sampleRate: Number(sampleRate),
    });
  }

  // Since this is coming from the user (or from a function provided by the user), who knows what we might get. (The
  // only valid values are booleans or numbers between 0 and 1.)
  if (!isValidSampleRate(sampleRate)) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('[Tracing] Discarding transaction because of invalid sample rate.');
    transaction.sampled = false;
    return transaction;
  }

  // if the function returned 0 (or false), or if `tracesSampleRate` is 0, it's a sign the transaction should be dropped
  if (!sampleRate) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
      utils.logger.log(
        `[Tracing] Discarding transaction because ${
          typeof options.tracesSampler === 'function'
            ? 'tracesSampler returned 0 or false'
            : 'a negative sampling decision was inherited or tracesSampleRate is set to 0'
        }`,
      );
    transaction.sampled = false;
    return transaction;
  }

  // Now we roll the dice. Math.random is inclusive of 0, but not of 1, so strict < is safe here. In case sampleRate is
  // a boolean, the < comparison will cause it to be automatically cast to 1 if it's true and 0 if it's false.
  transaction.sampled = Math.random() < (sampleRate );

  // if we're not going to keep it, we're done
  if (!transaction.sampled) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
      utils.logger.log(
        `[Tracing] Discarding transaction because it's not included in the random sample (sampling rate = ${Number(
          sampleRate,
        )})`,
      );
    return transaction;
  }

  (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`[Tracing] starting ${transaction.op} transaction - ${transaction.name}`);
  return transaction;
}

/**
 * Checks the given sample rate to make sure it is valid type and value (a boolean, or a number between 0 and 1).
 */
function isValidSampleRate(rate) {
  // we need to check NaN explicitly because it's of type 'number' and therefore wouldn't get caught by this typecheck
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (utils.isNaN(rate) || !(typeof rate === 'number' || typeof rate === 'boolean')) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
      utils.logger.warn(
        `[Tracing] Given sample rate is invalid. Sample rate must be a boolean or a number between 0 and 1. Got ${JSON.stringify(
          rate,
        )} of type ${JSON.stringify(typeof rate)}.`,
      );
    return false;
  }

  // in case sampleRate is a boolean, it will get automatically cast to 1 if it's true and 0 if it's false
  if (rate < 0 || rate > 1) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
      utils.logger.warn(`[Tracing] Given sample rate is invalid. Sample rate must be between 0 and 1. Got ${rate}.`);
    return false;
  }
  return true;
}

/**
 * Creates a new transaction and adds a sampling decision if it doesn't yet have one.
 *
 * The Hub.startTransaction method delegates to this method to do its work, passing the Hub instance in as `this`, as if
 * it had been called on the hub directly. Exists as a separate function so that it can be injected into the class as an
 * "extension method."
 *
 * @param this: The Hub starting the transaction
 * @param transactionContext: Data used to configure the transaction
 * @param CustomSamplingContext: Optional data to be provided to the `tracesSampler` function (if any)
 *
 * @returns The new transaction
 *
 * @see {@link Hub.startTransaction}
 */
function _startTransaction(

  transactionContext,
  customSamplingContext,
) {
  const client = this.getClient();
  const options = (client && client.getOptions()) || {};

  const configInstrumenter = options.instrumenter || 'sentry';
  const transactionInstrumenter = transactionContext.instrumenter || 'sentry';

  if (configInstrumenter !== transactionInstrumenter) {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
      utils.logger.error(
        `A transaction was started with instrumenter=\`${transactionInstrumenter}\`, but the SDK is configured with the \`${configInstrumenter}\` instrumenter.
The transaction will not be sampled. Please use the ${configInstrumenter} instrumentation to start transactions.`,
      );

    transactionContext.sampled = false;
  }

  let transaction$1 = new transaction.Transaction(transactionContext, this);
  transaction$1 = sample(transaction$1, options, {
    parentSampled: transactionContext.parentSampled,
    transactionContext,
    ...customSamplingContext,
  });
  if (transaction$1.sampled) {
    transaction$1.initSpanRecorder(options._experiments && (options._experiments.maxSpans ));
  }
  return transaction$1;
}

/**
 * Create new idle transaction.
 */
function startIdleTransaction(
  hub,
  transactionContext,
  idleTimeout,
  finalTimeout,
  onScope,
  customSamplingContext,
  heartbeatInterval,
) {
  const client = hub.getClient();
  const options = (client && client.getOptions()) || {};

  let transaction = new idletransaction.IdleTransaction(transactionContext, hub, idleTimeout, finalTimeout, heartbeatInterval, onScope);
  transaction = sample(transaction, options, {
    parentSampled: transactionContext.parentSampled,
    transactionContext,
    ...customSamplingContext,
  });
  if (transaction.sampled) {
    transaction.initSpanRecorder(options._experiments && (options._experiments.maxSpans ));
  }
  return transaction;
}

/**
 * @private
 */
function _addTracingExtensions() {
  const carrier = core.getMainCarrier();
  if (!carrier.__SENTRY__) {
    return;
  }
  carrier.__SENTRY__.extensions = carrier.__SENTRY__.extensions || {};
  if (!carrier.__SENTRY__.extensions.startTransaction) {
    carrier.__SENTRY__.extensions.startTransaction = _startTransaction;
  }
  if (!carrier.__SENTRY__.extensions.traceHeaders) {
    carrier.__SENTRY__.extensions.traceHeaders = traceHeaders;
  }
}

/**
 * @private
 */
function _autoloadDatabaseIntegrations() {
  const carrier = core.getMainCarrier();
  if (!carrier.__SENTRY__) {
    return;
  }

  const packageToIntegrationMapping = {
    mongodb() {
      const integration = utils.dynamicRequire(module, './integrations/node/mongo')

;
      return new integration.Mongo();
    },
    mongoose() {
      const integration = utils.dynamicRequire(module, './integrations/node/mongo')

;
      return new integration.Mongo({ mongoose: true });
    },
    mysql() {
      const integration = utils.dynamicRequire(module, './integrations/node/mysql')

;
      return new integration.Mysql();
    },
    pg() {
      const integration = utils.dynamicRequire(module, './integrations/node/postgres')

;
      return new integration.Postgres();
    },
  };

  const mappedPackages = Object.keys(packageToIntegrationMapping)
    .filter(moduleName => !!utils.loadModule(moduleName))
    .map(pkg => {
      try {
        return packageToIntegrationMapping[pkg]();
      } catch (e) {
        return undefined;
      }
    })
    .filter(p => p) ;

  if (mappedPackages.length > 0) {
    carrier.__SENTRY__.integrations = [...(carrier.__SENTRY__.integrations || []), ...mappedPackages];
  }
}

/**
 * This patches the global object and injects the Tracing extensions methods
 */
function addExtensionMethods() {
  _addTracingExtensions();

  // Detect and automatically load specified integrations.
  if (utils.isNodeEnv()) {
    _autoloadDatabaseIntegrations();
  }

  // If an error happens globally, we should make sure transaction status is set to error.
  errors.registerErrorInstrumentation();
}

exports._addTracingExtensions = _addTracingExtensions;
exports.addExtensionMethods = addExtensionMethods;
exports.startIdleTransaction = startIdleTransaction;
//# sourceMappingURL=hubextensions.js.map


/***/ }),

/***/ 5795:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const span = __webpack_require__(6776);
const transaction = __webpack_require__(7738);

const DEFAULT_IDLE_TIMEOUT = 1000;
const DEFAULT_FINAL_TIMEOUT = 30000;
const DEFAULT_HEARTBEAT_INTERVAL = 5000;

/**
 * @inheritDoc
 */
class IdleTransactionSpanRecorder extends span.SpanRecorder {
   constructor(
      _pushActivity,
      _popActivity,
     transactionSpanId,
    maxlen,
  ) {
    super(maxlen);this._pushActivity = _pushActivity;this._popActivity = _popActivity;this.transactionSpanId = transactionSpanId;  }

  /**
   * @inheritDoc
   */
   add(span) {
    // We should make sure we do not push and pop activities for
    // the transaction that this span recorder belongs to.
    if (span.spanId !== this.transactionSpanId) {
      // We patch span.finish() to pop an activity after setting an endTimestamp.
      span.finish = (endTimestamp) => {
        span.endTimestamp = typeof endTimestamp === 'number' ? endTimestamp : utils.timestampWithMs();
        this._popActivity(span.spanId);
      };

      // We should only push new activities if the span does not have an end timestamp.
      if (span.endTimestamp === undefined) {
        this._pushActivity(span.spanId);
      }
    }

    super.add(span);
  }
}

/**
 * An IdleTransaction is a transaction that automatically finishes. It does this by tracking child spans as activities.
 * You can have multiple IdleTransactions active, but if the `onScope` option is specified, the idle transaction will
 * put itself on the scope on creation.
 */
class IdleTransaction extends transaction.Transaction {
  // Activities store a list of active spans
   __init() {this.activities = {};}

  // Track state of activities in previous heartbeat

  // Amount of times heartbeat has counted. Will cause transaction to finish after 3 beats.
   __init2() {this._heartbeatCounter = 0;}

  // We should not use heartbeat if we finished a transaction
   __init3() {this._finished = false;}

    __init4() {this._beforeFinishCallbacks = [];}

  /**
   * Timer that tracks Transaction idleTimeout
   */

   constructor(
    transactionContext,
      _idleHub,
    /**
     * The time to wait in ms until the idle transaction will be finished. This timer is started each time
     * there are no active spans on this transaction.
     */
      _idleTimeout = DEFAULT_IDLE_TIMEOUT,
    /**
     * The final value in ms that a transaction cannot exceed
     */
      _finalTimeout = DEFAULT_FINAL_TIMEOUT,
      _heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL,
    // Whether or not the transaction should put itself on the scope when it starts and pop itself off when it ends
      _onScope = false,
  ) {
    super(transactionContext, _idleHub);this._idleHub = _idleHub;this._idleTimeout = _idleTimeout;this._finalTimeout = _finalTimeout;this._heartbeatInterval = _heartbeatInterval;this._onScope = _onScope;IdleTransaction.prototype.__init.call(this);IdleTransaction.prototype.__init2.call(this);IdleTransaction.prototype.__init3.call(this);IdleTransaction.prototype.__init4.call(this);
    if (_onScope) {
      // There should only be one active transaction on the scope
      clearActiveTransaction(_idleHub);

      // We set the transaction here on the scope so error events pick up the trace
      // context and attach it to the error.
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`Setting idle transaction on scope. Span ID: ${this.spanId}`);
      _idleHub.configureScope(scope => scope.setSpan(this));
    }

    this._startIdleTimeout();
    setTimeout(() => {
      if (!this._finished) {
        this.setStatus('deadline_exceeded');
        this.finish();
      }
    }, this._finalTimeout);
  }

  /** {@inheritDoc} */
   finish(endTimestamp = utils.timestampWithMs()) {
    this._finished = true;
    this.activities = {};

    if (this.spanRecorder) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
        utils.logger.log('[Tracing] finishing IdleTransaction', new Date(endTimestamp * 1000).toISOString(), this.op);

      for (const callback of this._beforeFinishCallbacks) {
        callback(this, endTimestamp);
      }

      this.spanRecorder.spans = this.spanRecorder.spans.filter((span) => {
        // If we are dealing with the transaction itself, we just return it
        if (span.spanId === this.spanId) {
          return true;
        }

        // We cancel all pending spans with status "cancelled" to indicate the idle transaction was finished early
        if (!span.endTimestamp) {
          span.endTimestamp = endTimestamp;
          span.setStatus('cancelled');
          (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
            utils.logger.log('[Tracing] cancelling span since transaction ended early', JSON.stringify(span, undefined, 2));
        }

        const keepSpan = span.startTimestamp < endTimestamp;
        if (!keepSpan) {
          (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
            utils.logger.log(
              '[Tracing] discarding Span since it happened after Transaction was finished',
              JSON.stringify(span, undefined, 2),
            );
        }
        return keepSpan;
      });

      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Tracing] flushing IdleTransaction');
    } else {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Tracing] No active IdleTransaction');
    }

    // if `this._onScope` is `true`, the transaction put itself on the scope when it started
    if (this._onScope) {
      clearActiveTransaction(this._idleHub);
    }

    return super.finish(endTimestamp);
  }

  /**
   * Register a callback function that gets excecuted before the transaction finishes.
   * Useful for cleanup or if you want to add any additional spans based on current context.
   *
   * This is exposed because users have no other way of running something before an idle transaction
   * finishes.
   */
   registerBeforeFinishCallback(callback) {
    this._beforeFinishCallbacks.push(callback);
  }

  /**
   * @inheritDoc
   */
   initSpanRecorder(maxlen) {
    if (!this.spanRecorder) {
      const pushActivity = (id) => {
        if (this._finished) {
          return;
        }
        this._pushActivity(id);
      };
      const popActivity = (id) => {
        if (this._finished) {
          return;
        }
        this._popActivity(id);
      };

      this.spanRecorder = new IdleTransactionSpanRecorder(pushActivity, popActivity, this.spanId, maxlen);

      // Start heartbeat so that transactions do not run forever.
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Starting heartbeat');
      this._pingHeartbeat();
    }
    this.spanRecorder.add(this);
  }

  /**
   * Cancels the existing idletimeout, if there is one
   */
   _cancelIdleTimeout() {
    if (this._idleTimeoutID) {
      clearTimeout(this._idleTimeoutID);
      this._idleTimeoutID = undefined;
    }
  }

  /**
   * Creates an idletimeout
   */
   _startIdleTimeout(endTimestamp) {
    this._cancelIdleTimeout();
    this._idleTimeoutID = setTimeout(() => {
      if (!this._finished && Object.keys(this.activities).length === 0) {
        this.finish(endTimestamp);
      }
    }, this._idleTimeout);
  }

  /**
   * Start tracking a specific activity.
   * @param spanId The span id that represents the activity
   */
   _pushActivity(spanId) {
    this._cancelIdleTimeout();
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`[Tracing] pushActivity: ${spanId}`);
    this.activities[spanId] = true;
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Tracing] new activities count', Object.keys(this.activities).length);
  }

  /**
   * Remove an activity from usage
   * @param spanId The span id that represents the activity
   */
   _popActivity(spanId) {
    if (this.activities[spanId]) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`[Tracing] popActivity ${spanId}`);
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.activities[spanId];
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Tracing] new activities count', Object.keys(this.activities).length);
    }

    if (Object.keys(this.activities).length === 0) {
      // We need to add the timeout here to have the real endtimestamp of the transaction
      // Remember timestampWithMs is in seconds, timeout is in ms
      const endTimestamp = utils.timestampWithMs() + this._idleTimeout / 1000;
      this._startIdleTimeout(endTimestamp);
    }
  }

  /**
   * Checks when entries of this.activities are not changing for 3 beats.
   * If this occurs we finish the transaction.
   */
   _beat() {
    // We should not be running heartbeat if the idle transaction is finished.
    if (this._finished) {
      return;
    }

    const heartbeatString = Object.keys(this.activities).join('');

    if (heartbeatString === this._prevHeartbeatString) {
      this._heartbeatCounter++;
    } else {
      this._heartbeatCounter = 1;
    }

    this._prevHeartbeatString = heartbeatString;

    if (this._heartbeatCounter >= 3) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Tracing] Transaction finished because of no change for 3 heart beats');
      this.setStatus('deadline_exceeded');
      this.finish();
    } else {
      this._pingHeartbeat();
    }
  }

  /**
   * Pings the heartbeat
   */
   _pingHeartbeat() {
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`pinging Heartbeat -> current counter: ${this._heartbeatCounter}`);
    setTimeout(() => {
      this._beat();
    }, this._heartbeatInterval);
  }
}

/**
 * Reset transaction on scope to `undefined`
 */
function clearActiveTransaction(hub) {
  const scope = hub.getScope();
  if (scope) {
    const transaction = scope.getTransaction();
    if (transaction) {
      scope.setSpan(undefined);
    }
  }
}

exports.DEFAULT_FINAL_TIMEOUT = DEFAULT_FINAL_TIMEOUT;
exports.DEFAULT_HEARTBEAT_INTERVAL = DEFAULT_HEARTBEAT_INTERVAL;
exports.DEFAULT_IDLE_TIMEOUT = DEFAULT_IDLE_TIMEOUT;
exports.IdleTransaction = IdleTransaction;
exports.IdleTransactionSpanRecorder = IdleTransactionSpanRecorder;
//# sourceMappingURL=idletransaction.js.map


/***/ }),

/***/ 7363:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const hubextensions = __webpack_require__(6411);
const index = __webpack_require__(3601);
const browsertracing = __webpack_require__(9370);
const request = __webpack_require__(5592);
const span = __webpack_require__(6776);
const spanstatus = __webpack_require__(8284);
const transaction = __webpack_require__(7738);
const idletransaction = __webpack_require__(5795);
const utils$1 = __webpack_require__(562);
const utils = __webpack_require__(9425);

// Treeshakable guard to remove all code related to tracing

// Guard for tree
if (typeof __SENTRY_TRACING__ === 'undefined' || __SENTRY_TRACING__) {
  // We are patching the global object with our hub extension methods
  hubextensions.addExtensionMethods();
}

exports.addExtensionMethods = hubextensions.addExtensionMethods;
exports.startIdleTransaction = hubextensions.startIdleTransaction;
exports.Integrations = index;
exports.BROWSER_TRACING_INTEGRATION_ID = browsertracing.BROWSER_TRACING_INTEGRATION_ID;
exports.BrowserTracing = browsertracing.BrowserTracing;
exports.defaultRequestInstrumentationOptions = request.defaultRequestInstrumentationOptions;
exports.instrumentOutgoingRequests = request.instrumentOutgoingRequests;
exports.Span = span.Span;
exports.spanStatusfromHttpCode = span.spanStatusfromHttpCode;
Object.defineProperty(exports, "SpanStatus", ({
  enumerable: true,
  get: () => spanstatus.SpanStatus
}));
exports.Transaction = transaction.Transaction;
exports.IdleTransaction = idletransaction.IdleTransaction;
exports.getActiveTransaction = utils$1.getActiveTransaction;
exports.hasTracingEnabled = utils$1.hasTracingEnabled;
exports.TRACEPARENT_REGEXP = utils.TRACEPARENT_REGEXP;
exports.extractTraceparentData = utils.extractTraceparentData;
exports.stripUrlQueryAndFragment = utils.stripUrlQueryAndFragment;
//# sourceMappingURL=index.js.map


/***/ }),

/***/ 3601:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const express = __webpack_require__(4809);
const postgres = __webpack_require__(938);
const mysql = __webpack_require__(1560);
const mongo = __webpack_require__(2488);
const prisma = __webpack_require__(2705);
const graphql = __webpack_require__(2244);
const apollo = __webpack_require__(8226);
const browsertracing = __webpack_require__(9370);
__webpack_require__(3377);
__webpack_require__(9425);



exports.Express = express.Express;
exports.Postgres = postgres.Postgres;
exports.Mysql = mysql.Mysql;
exports.Mongo = mongo.Mongo;
exports.Prisma = prisma.Prisma;
exports.GraphQL = graphql.GraphQL;
exports.Apollo = apollo.Apollo;
exports.BrowserTracing = browsertracing.BrowserTracing;
//# sourceMappingURL=index.js.map


/***/ }),

/***/ 8226:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const nodeUtils = __webpack_require__(3525);

/** Tracing integration for Apollo */
class Apollo  {constructor() { Apollo.prototype.__init.call(this); }
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Apollo';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Apollo.id;}

  /**
   * @inheritDoc
   */
   setupOnce(_, getCurrentHub) {
    if (nodeUtils.shouldDisableAutoInstrumentation(getCurrentHub)) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Apollo Integration is skipped because of instrumenter configuration.');
      return;
    }

    const pkg = utils.loadModule

('apollo-server-core');

    if (!pkg) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error('Apollo Integration was unable to require apollo-server-core package.');
      return;
    }

    /**
     * Iterate over resolvers of the ApolloServer instance before schemas are constructed.
     */
    utils.fill(pkg.ApolloServerBase.prototype, 'constructSchema', function (orig) {
      return function () {
        if (!this.config.resolvers) {
          if ((typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__)) {
            if (this.config.schema) {
              utils.logger.warn(
                'Apollo integration is not able to trace `ApolloServer` instances constructed via `schema` property.',
              );
            } else if (this.config.modules) {
              utils.logger.warn(
                'Apollo integration is not able to trace `ApolloServer` instances constructed via `modules` property.',
              );
            }

            utils.logger.error('Skipping tracing as no resolvers found on the `ApolloServer` instance.');
          }

          return orig.call(this);
        }

        const resolvers = utils.arrayify(this.config.resolvers);

        this.config.resolvers = resolvers.map(model => {
          Object.keys(model).forEach(resolverGroupName => {
            Object.keys(model[resolverGroupName]).forEach(resolverName => {
              if (typeof model[resolverGroupName][resolverName] !== 'function') {
                return;
              }

              wrapResolver(model, resolverGroupName, resolverName, getCurrentHub);
            });
          });

          return model;
        });

        return orig.call(this);
      };
    });
  }
}Apollo.__initStatic();

/**
 * Wrap a single resolver which can be a parent of other resolvers and/or db operations.
 */
function wrapResolver(
  model,
  resolverGroupName,
  resolverName,
  getCurrentHub,
) {
  utils.fill(model[resolverGroupName], resolverName, function (orig) {
    return function ( ...args) {
      const scope = getCurrentHub().getScope();
      const parentSpan = _optionalChain([scope, 'optionalAccess', _2 => _2.getSpan, 'call', _3 => _3()]);
      const span = _optionalChain([parentSpan, 'optionalAccess', _4 => _4.startChild, 'call', _5 => _5({
        description: `${resolverGroupName}.${resolverName}`,
        op: 'graphql.resolve',
      })]);

      const rv = orig.call(this, ...args);

      if (utils.isThenable(rv)) {
        return rv.then((res) => {
          _optionalChain([span, 'optionalAccess', _6 => _6.finish, 'call', _7 => _7()]);
          return res;
        });
      }

      _optionalChain([span, 'optionalAccess', _8 => _8.finish, 'call', _9 => _9()]);

      return rv;
    };
  });
}

exports.Apollo = Apollo;
//# sourceMappingURL=apollo.js.map


/***/ }),

/***/ 4809:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const nodeUtils = __webpack_require__(3525);

/**
 * Express integration
 *
 * Provides an request and error handler for Express framework as well as tracing capabilities
 */
class Express  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Express';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Express.id;}

  /**
   * Express App instance
   */

  /**
   * @inheritDoc
   */
   constructor(options = {}) {Express.prototype.__init.call(this);
    this._router = options.router || options.app;
    this._methods = (Array.isArray(options.methods) ? options.methods : []).concat('use');
  }

  /**
   * @inheritDoc
   */
   setupOnce(_, getCurrentHub) {
    if (!this._router) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error('ExpressIntegration is missing an Express instance');
      return;
    }

    if (nodeUtils.shouldDisableAutoInstrumentation(getCurrentHub)) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Express Integration is skipped because of instrumenter configuration.');
      return;
    }

    instrumentMiddlewares(this._router, this._methods);
    instrumentRouter(this._router );
  }
}Express.__initStatic();

/**
 * Wraps original middleware function in a tracing call, which stores the info about the call as a span,
 * and finishes it once the middleware is done invoking.
 *
 * Express middlewares have 3 various forms, thus we have to take care of all of them:
 * // sync
 * app.use(function (req, res) { ... })
 * // async
 * app.use(function (req, res, next) { ... })
 * // error handler
 * app.use(function (err, req, res, next) { ... })
 *
 * They all internally delegate to the `router[method]` of the given application instance.
 */
// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
function wrap(fn, method) {
  const arity = fn.length;

  switch (arity) {
    case 2: {
      return function ( req, res) {
        const transaction = res.__sentry_transaction;
        if (transaction) {
          const span = transaction.startChild({
            description: fn.name,
            op: `middleware.express.${method}`,
          });
          res.once('finish', () => {
            span.finish();
          });
        }
        return fn.call(this, req, res);
      };
    }
    case 3: {
      return function (

        req,
        res,
        next,
      ) {
        const transaction = res.__sentry_transaction;
        const span = _optionalChain([transaction, 'optionalAccess', _2 => _2.startChild, 'call', _3 => _3({
          description: fn.name,
          op: `middleware.express.${method}`,
        })]);
        fn.call(this, req, res, function ( ...args) {
          _optionalChain([span, 'optionalAccess', _4 => _4.finish, 'call', _5 => _5()]);
          next.call(this, ...args);
        });
      };
    }
    case 4: {
      return function (

        err,
        req,
        res,
        next,
      ) {
        const transaction = res.__sentry_transaction;
        const span = _optionalChain([transaction, 'optionalAccess', _6 => _6.startChild, 'call', _7 => _7({
          description: fn.name,
          op: `middleware.express.${method}`,
        })]);
        fn.call(this, err, req, res, function ( ...args) {
          _optionalChain([span, 'optionalAccess', _8 => _8.finish, 'call', _9 => _9()]);
          next.call(this, ...args);
        });
      };
    }
    default: {
      throw new Error(`Express middleware takes 2-4 arguments. Got: ${arity}`);
    }
  }
}

/**
 * Takes all the function arguments passed to the original `app` or `router` method, eg. `app.use` or `router.use`
 * and wraps every function, as well as array of functions with a call to our `wrap` method.
 * We have to take care of the arrays as well as iterate over all of the arguments,
 * as `app.use` can accept middlewares in few various forms.
 *
 * app.use([<path>], <fn>)
 * app.use([<path>], <fn>, ...<fn>)
 * app.use([<path>], ...<fn>[])
 */
function wrapMiddlewareArgs(args, method) {
  return args.map((arg) => {
    if (typeof arg === 'function') {
      return wrap(arg, method);
    }

    if (Array.isArray(arg)) {
      return arg.map((a) => {
        if (typeof a === 'function') {
          return wrap(a, method);
        }
        return a;
      });
    }

    return arg;
  });
}

/**
 * Patches original router to utilize our tracing functionality
 */
function patchMiddleware(router, method) {
  const originalCallback = router[method];

  router[method] = function (...args) {
    return originalCallback.call(this, ...wrapMiddlewareArgs(args, method));
  };

  return router;
}

/**
 * Patches original router methods
 */
function instrumentMiddlewares(router, methods = []) {
  methods.forEach((method) => patchMiddleware(router, method));
}

/**
 * Patches the prototype of Express.Router to accumulate the resolved route
 * if a layer instance's `match` function was called and it returned a successful match.
 *
 * @see https://github.com/expressjs/express/blob/master/lib/router/index.js
 *
 * @param appOrRouter the router instance which can either be an app (i.e. top-level) or a (nested) router.
 */
function instrumentRouter(appOrRouter) {
  // This is how we can distinguish between app and routers
  const isApp = 'settings' in appOrRouter;

  // In case the app's top-level router hasn't been initialized yet, we have to do it now
  if (isApp && appOrRouter._router === undefined && appOrRouter.lazyrouter) {
    appOrRouter.lazyrouter();
  }

  const router = isApp ? appOrRouter._router : appOrRouter;

  if (!router) {
    /*
    If we end up here, this means likely that this integration is used with Express 3 or Express 5.
    For now, we don't support these versions (3 is very old and 5 is still in beta). To support Express 5,
    we'd need to make more changes to the routing instrumentation because the router is no longer part of
    the Express core package but maintained in its own package. The new router has different function
    signatures and works slightly differently, demanding more changes than just taking the router from
    `app.router` instead of `app._router`.
    @see https://github.com/pillarjs/router

    TODO: Proper Express 5 support
    */
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.debug('Cannot instrument router for URL Parameterization (did not find a valid router).');
    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.debug('Routing instrumentation is currently only supported in Express 4.');
    return;
  }

  const routerProto = Object.getPrototypeOf(router) ;

  const originalProcessParams = routerProto.process_params;
  routerProto.process_params = function process_params(
    layer,
    called,
    req,
    res,
    done,
  ) {
    // Base case: We're in the first part of the URL (thus we start with the root '/')
    if (!req._reconstructedRoute) {
      req._reconstructedRoute = '';
    }

    // If the layer's partial route has params, is a regex or an array, the route is stored in layer.route.
    const { layerRoutePath, isRegex, isArray, numExtraSegments } = getLayerRoutePathInfo(layer);

    if (layerRoutePath || isRegex || isArray) {
      req._hasParameters = true;
    }

    // Otherwise, the hardcoded path (i.e. a partial route without params) is stored in layer.path
    const partialRoute = layerRoutePath || layer.path || '';

    // Normalize the partial route so that it doesn't contain leading or trailing slashes
    // and exclude empty or '*' wildcard routes.
    // The exclusion of '*' routes is our best effort to not "pollute" the transaction name
    // with interim handlers (e.g. ones that check authentication or do other middleware stuff).
    // We want to end up with the parameterized URL of the incoming request without any extraneous path segments.
    const finalPartialRoute = partialRoute
      .split('/')
      .filter(segment => segment.length > 0 && (isRegex || isArray || !segment.includes('*')))
      .join('/');

    // If we found a valid partial URL, we append it to the reconstructed route
    if (finalPartialRoute && finalPartialRoute.length > 0) {
      // If the partial route is from a regex route, we append a '/' to close the regex
      req._reconstructedRoute += `/${finalPartialRoute}${isRegex ? '/' : ''}`;
    }

    // Now we check if we are in the "last" part of the route. We determine this by comparing the
    // number of URL segments from the original URL to that of our reconstructed parameterized URL.
    // If we've reached our final destination, we update the transaction name.
    const urlLength = utils.getNumberOfUrlSegments(req.originalUrl || '') + numExtraSegments;
    const routeLength = utils.getNumberOfUrlSegments(req._reconstructedRoute);

    if (urlLength === routeLength) {
      if (!req._hasParameters) {
        if (req._reconstructedRoute !== req.originalUrl) {
          req._reconstructedRoute = req.originalUrl;
        }
      }

      const transaction = res.__sentry_transaction;
      if (transaction && transaction.metadata.source !== 'custom') {
        // If the request URL is '/' or empty, the reconstructed route will be empty.
        // Therefore, we fall back to setting the final route to '/' in this case.
        const finalRoute = req._reconstructedRoute || '/';

        transaction.setName(...utils.extractPathForTransaction(req, { path: true, method: true, customRoute: finalRoute }));
      }
    }

    return originalProcessParams.call(this, layer, called, req, res, done);
  };
}

/**
 * Extracts and stringifies the layer's route which can either be a string with parameters (`users/:id`),
 * a RegEx (`/test/`) or an array of strings and regexes (`['/path1', /\/path[2-5]/, /path/:id]`). Additionally
 * returns extra information about the route, such as if the route is defined as regex or as an array.
 *
 * @param layer the layer to extract the stringified route from
 *
 * @returns an object containing the stringified route, a flag determining if the route was a regex
 *          and the number of extra segments to the matched path that are additionally in the route,
 *          if the route was an array (defaults to 0).
 */
function getLayerRoutePathInfo(layer) {
  const lrp = _optionalChain([layer, 'access', _10 => _10.route, 'optionalAccess', _11 => _11.path]);

  const isRegex = utils.isRegExp(lrp);
  const isArray = Array.isArray(lrp);

  if (!lrp) {
    return { isRegex, isArray, numExtraSegments: 0 };
  }

  const numExtraSegments = isArray
    ? Math.max(getNumberOfArrayUrlSegments(lrp ) - utils.getNumberOfUrlSegments(layer.path || ''), 0)
    : 0;

  const layerRoutePath = getLayerRoutePathString(isArray, lrp);

  return { layerRoutePath, isRegex, isArray, numExtraSegments };
}

/**
 * Returns the number of URL segments in an array of routes
 *
 * Example: ['/api/test', /\/api\/post[0-9]/, '/users/:id/details`] -> 7
 */
function getNumberOfArrayUrlSegments(routesArray) {
  return routesArray.reduce((accNumSegments, currentRoute) => {
    // array members can be a RegEx -> convert them toString
    return accNumSegments + utils.getNumberOfUrlSegments(currentRoute.toString());
  }, 0);
}

/**
 * Extracts and returns the stringified version of the layers route path
 * Handles route arrays (by joining the paths together) as well as RegExp and normal
 * string values (in the latter case the toString conversion is technically unnecessary but
 * it doesn't hurt us either).
 */
function getLayerRoutePathString(isArray, lrp) {
  if (isArray) {
    return (lrp ).map(r => r.toString()).join(',');
  }
  return lrp && lrp.toString();
}

exports.Express = Express;
//# sourceMappingURL=express.js.map


/***/ }),

/***/ 2244:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const nodeUtils = __webpack_require__(3525);

/** Tracing integration for graphql package */
class GraphQL  {constructor() { GraphQL.prototype.__init.call(this); }
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'GraphQL';}

  /**
   * @inheritDoc
   */
   __init() {this.name = GraphQL.id;}

  /**
   * @inheritDoc
   */
   setupOnce(_, getCurrentHub) {
    if (nodeUtils.shouldDisableAutoInstrumentation(getCurrentHub)) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('GraphQL Integration is skipped because of instrumenter configuration.');
      return;
    }

    const pkg = utils.loadModule

('graphql/execution/execute.js');

    if (!pkg) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error('GraphQL Integration was unable to require graphql/execution package.');
      return;
    }

    utils.fill(pkg, 'execute', function (orig) {
      return function ( ...args) {
        const scope = getCurrentHub().getScope();
        const parentSpan = _optionalChain([scope, 'optionalAccess', _2 => _2.getSpan, 'call', _3 => _3()]);

        const span = _optionalChain([parentSpan, 'optionalAccess', _4 => _4.startChild, 'call', _5 => _5({
          description: 'execute',
          op: 'graphql.execute',
        })]);

        _optionalChain([scope, 'optionalAccess', _6 => _6.setSpan, 'call', _7 => _7(span)]);

        const rv = orig.call(this, ...args);

        if (utils.isThenable(rv)) {
          return rv.then((res) => {
            _optionalChain([span, 'optionalAccess', _8 => _8.finish, 'call', _9 => _9()]);
            _optionalChain([scope, 'optionalAccess', _10 => _10.setSpan, 'call', _11 => _11(parentSpan)]);

            return res;
          });
        }

        _optionalChain([span, 'optionalAccess', _12 => _12.finish, 'call', _13 => _13()]);
        _optionalChain([scope, 'optionalAccess', _14 => _14.setSpan, 'call', _15 => _15(parentSpan)]);
        return rv;
      };
    });
  }
}GraphQL.__initStatic();

exports.GraphQL = GraphQL;
//# sourceMappingURL=graphql.js.map


/***/ }),

/***/ 2488:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const nodeUtils = __webpack_require__(3525);

// This allows us to use the same array for both defaults options and the type itself.
// (note `as const` at the end to make it a union of string literal types (i.e. "a" | "b" | ... )
// and not just a string[])

const OPERATIONS = [
  'aggregate', // aggregate(pipeline, options, callback)
  'bulkWrite', // bulkWrite(operations, options, callback)
  'countDocuments', // countDocuments(query, options, callback)
  'createIndex', // createIndex(fieldOrSpec, options, callback)
  'createIndexes', // createIndexes(indexSpecs, options, callback)
  'deleteMany', // deleteMany(filter, options, callback)
  'deleteOne', // deleteOne(filter, options, callback)
  'distinct', // distinct(key, query, options, callback)
  'drop', // drop(options, callback)
  'dropIndex', // dropIndex(indexName, options, callback)
  'dropIndexes', // dropIndexes(options, callback)
  'estimatedDocumentCount', // estimatedDocumentCount(options, callback)
  'find', // find(query, options, callback)
  'findOne', // findOne(query, options, callback)
  'findOneAndDelete', // findOneAndDelete(filter, options, callback)
  'findOneAndReplace', // findOneAndReplace(filter, replacement, options, callback)
  'findOneAndUpdate', // findOneAndUpdate(filter, update, options, callback)
  'indexes', // indexes(options, callback)
  'indexExists', // indexExists(indexes, options, callback)
  'indexInformation', // indexInformation(options, callback)
  'initializeOrderedBulkOp', // initializeOrderedBulkOp(options, callback)
  'insertMany', // insertMany(docs, options, callback)
  'insertOne', // insertOne(doc, options, callback)
  'isCapped', // isCapped(options, callback)
  'mapReduce', // mapReduce(map, reduce, options, callback)
  'options', // options(options, callback)
  'parallelCollectionScan', // parallelCollectionScan(options, callback)
  'rename', // rename(newName, options, callback)
  'replaceOne', // replaceOne(filter, doc, options, callback)
  'stats', // stats(options, callback)
  'updateMany', // updateMany(filter, update, options, callback)
  'updateOne', // updateOne(filter, update, options, callback)
] ;

// All of the operations above take `options` and `callback` as their final parameters, but some of them
// take additional parameters as well. For those operations, this is a map of
// { <operation name>:  [<names of additional parameters>] }, as a way to know what to call the operation's
// positional arguments when we add them to the span's `data` object later
const OPERATION_SIGNATURES

 = {
  // aggregate intentionally not included because `pipeline` arguments are too complex to serialize well
  // see https://github.com/getsentry/sentry-javascript/pull/3102
  bulkWrite: ['operations'],
  countDocuments: ['query'],
  createIndex: ['fieldOrSpec'],
  createIndexes: ['indexSpecs'],
  deleteMany: ['filter'],
  deleteOne: ['filter'],
  distinct: ['key', 'query'],
  dropIndex: ['indexName'],
  find: ['query'],
  findOne: ['query'],
  findOneAndDelete: ['filter'],
  findOneAndReplace: ['filter', 'replacement'],
  findOneAndUpdate: ['filter', 'update'],
  indexExists: ['indexes'],
  insertMany: ['docs'],
  insertOne: ['doc'],
  mapReduce: ['map', 'reduce'],
  rename: ['newName'],
  replaceOne: ['filter', 'doc'],
  updateMany: ['filter', 'update'],
  updateOne: ['filter', 'update'],
};

function isCursor(maybeCursor) {
  return maybeCursor && typeof maybeCursor === 'object' && maybeCursor.once && typeof maybeCursor.once === 'function';
}

/** Tracing integration for mongo package */
class Mongo  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Mongo';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Mongo.id;}

  /**
   * @inheritDoc
   */
   constructor(options = {}) {Mongo.prototype.__init.call(this);
    this._operations = Array.isArray(options.operations) ? options.operations : (OPERATIONS );
    this._describeOperations = 'describeOperations' in options ? options.describeOperations : true;
    this._useMongoose = !!options.useMongoose;
  }

  /**
   * @inheritDoc
   */
   setupOnce(_, getCurrentHub) {
    if (nodeUtils.shouldDisableAutoInstrumentation(getCurrentHub)) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Mongo Integration is skipped because of instrumenter configuration.');
      return;
    }

    const moduleName = this._useMongoose ? 'mongoose' : 'mongodb';
    const pkg = utils.loadModule(moduleName);

    if (!pkg) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error(`Mongo Integration was unable to require \`${moduleName}\` package.`);
      return;
    }

    this._instrumentOperations(pkg.Collection, this._operations, getCurrentHub);
  }

  /**
   * Patches original collection methods
   */
   _instrumentOperations(collection, operations, getCurrentHub) {
    operations.forEach((operation) => this._patchOperation(collection, operation, getCurrentHub));
  }

  /**
   * Patches original collection to utilize our tracing functionality
   */
   _patchOperation(collection, operation, getCurrentHub) {
    if (!(operation in collection.prototype)) return;

    const getSpanContext = this._getSpanContextFromOperationArguments.bind(this);

    utils.fill(collection.prototype, operation, function (orig) {
      return function ( ...args) {
        const lastArg = args[args.length - 1];
        const scope = getCurrentHub().getScope();
        const parentSpan = _optionalChain([scope, 'optionalAccess', _2 => _2.getSpan, 'call', _3 => _3()]);

        // Check if the operation was passed a callback. (mapReduce requires a different check, as
        // its (non-callback) arguments can also be functions.)
        if (typeof lastArg !== 'function' || (operation === 'mapReduce' && args.length === 2)) {
          const span = _optionalChain([parentSpan, 'optionalAccess', _4 => _4.startChild, 'call', _5 => _5(getSpanContext(this, operation, args))]);
          const maybePromiseOrCursor = orig.call(this, ...args);

          if (utils.isThenable(maybePromiseOrCursor)) {
            return maybePromiseOrCursor.then((res) => {
              _optionalChain([span, 'optionalAccess', _6 => _6.finish, 'call', _7 => _7()]);
              return res;
            });
          }
          // If the operation returns a Cursor
          // we need to attach a listener to it to finish the span when the cursor is closed.
          else if (isCursor(maybePromiseOrCursor)) {
            const cursor = maybePromiseOrCursor ;

            try {
              cursor.once('close', () => {
                _optionalChain([span, 'optionalAccess', _8 => _8.finish, 'call', _9 => _9()]);
              });
            } catch (e) {
              // If the cursor is already closed, `once` will throw an error. In that case, we can
              // finish the span immediately.
              _optionalChain([span, 'optionalAccess', _10 => _10.finish, 'call', _11 => _11()]);
            }

            return cursor;
          } else {
            _optionalChain([span, 'optionalAccess', _12 => _12.finish, 'call', _13 => _13()]);
            return maybePromiseOrCursor;
          }
        }

        const span = _optionalChain([parentSpan, 'optionalAccess', _14 => _14.startChild, 'call', _15 => _15(getSpanContext(this, operation, args.slice(0, -1)))]);

        return orig.call(this, ...args.slice(0, -1), function (err, result) {
          _optionalChain([span, 'optionalAccess', _16 => _16.finish, 'call', _17 => _17()]);
          lastArg(err, result);
        });
      };
    });
  }

  /**
   * Form a SpanContext based on the user input to a given operation.
   */
   _getSpanContextFromOperationArguments(
    collection,
    operation,
    args,
  ) {
    const data = {
      collectionName: collection.collectionName,
      dbName: collection.dbName,
      namespace: collection.namespace,
    };
    const spanContext = {
      op: 'db',
      description: operation,
      data,
    };

    // If the operation takes no arguments besides `options` and `callback`, or if argument
    // collection is disabled for this operation, just return early.
    const signature = OPERATION_SIGNATURES[operation];
    const shouldDescribe = Array.isArray(this._describeOperations)
      ? this._describeOperations.includes(operation)
      : this._describeOperations;

    if (!signature || !shouldDescribe) {
      return spanContext;
    }

    try {
      // Special case for `mapReduce`, as the only one accepting functions as arguments.
      if (operation === 'mapReduce') {
        const [map, reduce] = args ;
        data[signature[0]] = typeof map === 'string' ? map : map.name || '<anonymous>';
        data[signature[1]] = typeof reduce === 'string' ? reduce : reduce.name || '<anonymous>';
      } else {
        for (let i = 0; i < signature.length; i++) {
          data[signature[i]] = JSON.stringify(args[i]);
        }
      }
    } catch (_oO) {
      // no-empty
    }

    return spanContext;
  }
}Mongo.__initStatic();

exports.Mongo = Mongo;
//# sourceMappingURL=mongo.js.map


/***/ }),

/***/ 1560:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const nodeUtils = __webpack_require__(3525);

/** Tracing integration for node-mysql package */
class Mysql  {constructor() { Mysql.prototype.__init.call(this); }
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Mysql';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Mysql.id;}

  /**
   * @inheritDoc
   */
   setupOnce(_, getCurrentHub) {
    if (nodeUtils.shouldDisableAutoInstrumentation(getCurrentHub)) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Mysql Integration is skipped because of instrumenter configuration.');
      return;
    }

    const pkg = utils.loadModule('mysql/lib/Connection.js');

    if (!pkg) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error('Mysql Integration was unable to require `mysql` package.');
      return;
    }

    // The original function will have one of these signatures:
    //    function (callback) => void
    //    function (options, callback) => void
    //    function (options, values, callback) => void
    utils.fill(pkg, 'createQuery', function (orig) {
      return function ( options, values, callback) {
        const scope = getCurrentHub().getScope();
        const parentSpan = _optionalChain([scope, 'optionalAccess', _2 => _2.getSpan, 'call', _3 => _3()]);
        const span = _optionalChain([parentSpan, 'optionalAccess', _4 => _4.startChild, 'call', _5 => _5({
          description: typeof options === 'string' ? options : (options ).sql,
          op: 'db',
        })]);

        if (typeof callback === 'function') {
          return orig.call(this, options, values, function (err, result, fields) {
            _optionalChain([span, 'optionalAccess', _6 => _6.finish, 'call', _7 => _7()]);
            callback(err, result, fields);
          });
        }

        if (typeof values === 'function') {
          return orig.call(this, options, function (err, result, fields) {
            _optionalChain([span, 'optionalAccess', _8 => _8.finish, 'call', _9 => _9()]);
            values(err, result, fields);
          });
        }

        return orig.call(this, options, values, callback);
      };
    });
  }
}Mysql.__initStatic();

exports.Mysql = Mysql;
//# sourceMappingURL=mysql.js.map


/***/ }),

/***/ 938:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const nodeUtils = __webpack_require__(3525);

/** Tracing integration for node-postgres package */
class Postgres  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Postgres';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Postgres.id;}

   constructor(options = {}) {Postgres.prototype.__init.call(this);
    this._usePgNative = !!options.usePgNative;
  }

  /**
   * @inheritDoc
   */
   setupOnce(_, getCurrentHub) {
    if (nodeUtils.shouldDisableAutoInstrumentation(getCurrentHub)) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Postgres Integration is skipped because of instrumenter configuration.');
      return;
    }

    const pkg = utils.loadModule('pg');

    if (!pkg) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error('Postgres Integration was unable to require `pg` package.');
      return;
    }

    if (this._usePgNative && !_optionalChain([pkg, 'access', _2 => _2.native, 'optionalAccess', _3 => _3.Client])) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error("Postgres Integration was unable to access 'pg-native' bindings.");
      return;
    }

    const { Client } = this._usePgNative ? pkg.native : pkg;

    /**
     * function (query, callback) => void
     * function (query, params, callback) => void
     * function (query) => Promise
     * function (query, params) => Promise
     * function (pg.Cursor) => pg.Cursor
     */
    utils.fill(Client.prototype, 'query', function (orig) {
      return function ( config, values, callback) {
        const scope = getCurrentHub().getScope();
        const parentSpan = _optionalChain([scope, 'optionalAccess', _4 => _4.getSpan, 'call', _5 => _5()]);
        const span = _optionalChain([parentSpan, 'optionalAccess', _6 => _6.startChild, 'call', _7 => _7({
          description: typeof config === 'string' ? config : (config ).text,
          op: 'db',
        })]);

        if (typeof callback === 'function') {
          return orig.call(this, config, values, function (err, result) {
            _optionalChain([span, 'optionalAccess', _8 => _8.finish, 'call', _9 => _9()]);
            callback(err, result);
          });
        }

        if (typeof values === 'function') {
          return orig.call(this, config, function (err, result) {
            _optionalChain([span, 'optionalAccess', _10 => _10.finish, 'call', _11 => _11()]);
            values(err, result);
          });
        }

        const rv = typeof values !== 'undefined' ? orig.call(this, config, values) : orig.call(this, config);

        if (utils.isThenable(rv)) {
          return rv.then((res) => {
            _optionalChain([span, 'optionalAccess', _12 => _12.finish, 'call', _13 => _13()]);
            return res;
          });
        }

        _optionalChain([span, 'optionalAccess', _14 => _14.finish, 'call', _15 => _15()]);
        return rv;
      };
    });
  }
}Postgres.__initStatic();

exports.Postgres = Postgres;
//# sourceMappingURL=postgres.js.map


/***/ }),

/***/ 2705:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
  _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);
const nodeUtils = __webpack_require__(3525);

function isValidPrismaClient(possibleClient) {
  return possibleClient && !!(possibleClient )['$use'];
}

/** Tracing integration for @prisma/client package */
class Prisma  {
  /**
   * @inheritDoc
   */
   static __initStatic() {this.id = 'Prisma';}

  /**
   * @inheritDoc
   */
   __init() {this.name = Prisma.id;}

  /**
   * Prisma ORM Client Instance
   */

  /**
   * @inheritDoc
   */
   constructor(options = {}) {Prisma.prototype.__init.call(this);
    if (isValidPrismaClient(options.client)) {
      this._client = options.client;
    } else {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
        utils.logger.warn(
          `Unsupported Prisma client provided to PrismaIntegration. Provided client: ${JSON.stringify(options.client)}`,
        );
    }
  }

  /**
   * @inheritDoc
   */
   setupOnce(_, getCurrentHub) {
    if (!this._client) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.error('PrismaIntegration is missing a Prisma Client Instance');
      return;
    }

    if (nodeUtils.shouldDisableAutoInstrumentation(getCurrentHub)) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('Prisma Integration is skipped because of instrumenter configuration.');
      return;
    }

    this._client.$use((params, next) => {
      const scope = getCurrentHub().getScope();
      const parentSpan = _optionalChain([scope, 'optionalAccess', _2 => _2.getSpan, 'call', _3 => _3()]);

      const action = params.action;
      const model = params.model;

      const span = _optionalChain([parentSpan, 'optionalAccess', _4 => _4.startChild, 'call', _5 => _5({
        description: model ? `${model} ${action}` : action,
        op: 'db.sql.prisma',
      })]);

      const rv = next(params);

      if (utils.isThenable(rv)) {
        return rv.then((res) => {
          _optionalChain([span, 'optionalAccess', _6 => _6.finish, 'call', _7 => _7()]);
          return res;
        });
      }

      _optionalChain([span, 'optionalAccess', _8 => _8.finish, 'call', _9 => _9()]);
      return rv;
    });
  }
}Prisma.__initStatic();

exports.Prisma = Prisma;
//# sourceMappingURL=prisma.js.map


/***/ }),

/***/ 3525:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var {
 _optionalChain
} = __webpack_require__(2699);

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Check if Sentry auto-instrumentation should be disabled.
 *
 * @param getCurrentHub A method to fetch the current hub
 * @returns boolean
 */
function shouldDisableAutoInstrumentation(getCurrentHub) {
  const clientOptions = _optionalChain([getCurrentHub, 'call', _ => _(), 'access', _2 => _2.getClient, 'call', _3 => _3(), 'optionalAccess', _4 => _4.getOptions, 'call', _5 => _5()]);
  const instrumenter = _optionalChain([clientOptions, 'optionalAccess', _6 => _6.instrumenter]) || 'sentry';

  return instrumenter !== 'sentry';
}

exports.shouldDisableAutoInstrumentation = shouldDisableAutoInstrumentation;
//# sourceMappingURL=node-utils.js.map


/***/ }),

/***/ 6776:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const utils = __webpack_require__(9425);

/**
 * Keeps track of finished spans for a given transaction
 * @internal
 * @hideconstructor
 * @hidden
 */
class SpanRecorder {
   __init() {this.spans = [];}

   constructor(maxlen = 1000) {SpanRecorder.prototype.__init.call(this);
    this._maxlen = maxlen;
  }

  /**
   * This is just so that we don't run out of memory while recording a lot
   * of spans. At some point we just stop and flush out the start of the
   * trace tree (i.e.the first n spans with the smallest
   * start_timestamp).
   */
   add(span) {
    if (this.spans.length > this._maxlen) {
      span.spanRecorder = undefined;
    } else {
      this.spans.push(span);
    }
  }
}

/**
 * Span contains all data about a span
 */
class Span  {
  /**
   * @inheritDoc
   */
   __init2() {this.traceId = utils.uuid4();}

  /**
   * @inheritDoc
   */
   __init3() {this.spanId = utils.uuid4().substring(16);}

  /**
   * @inheritDoc
   */

  /**
   * Internal keeper of the status
   */

  /**
   * @inheritDoc
   */

  /**
   * Timestamp in seconds when the span was created.
   */
   __init4() {this.startTimestamp = utils.timestampWithMs();}

  /**
   * Timestamp in seconds when the span ended.
   */

  /**
   * @inheritDoc
   */

  /**
   * @inheritDoc
   */

  /**
   * @inheritDoc
   */
   __init5() {this.tags = {};}

  /**
   * @inheritDoc
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
   __init6() {this.data = {};}

  /**
   * List of spans that were finalized
   */

  /**
   * @inheritDoc
   */

  /**
   * The instrumenter that created this span.
   */
   __init7() {this.instrumenter = 'sentry';}

  /**
   * You should never call the constructor manually, always use `Sentry.startTransaction()`
   * or call `startChild()` on an existing span.
   * @internal
   * @hideconstructor
   * @hidden
   */
   constructor(spanContext) {Span.prototype.__init2.call(this);Span.prototype.__init3.call(this);Span.prototype.__init4.call(this);Span.prototype.__init5.call(this);Span.prototype.__init6.call(this);Span.prototype.__init7.call(this);
    if (!spanContext) {
      return this;
    }
    if (spanContext.traceId) {
      this.traceId = spanContext.traceId;
    }
    if (spanContext.spanId) {
      this.spanId = spanContext.spanId;
    }
    if (spanContext.parentSpanId) {
      this.parentSpanId = spanContext.parentSpanId;
    }
    // We want to include booleans as well here
    if ('sampled' in spanContext) {
      this.sampled = spanContext.sampled;
    }
    if (spanContext.op) {
      this.op = spanContext.op;
    }
    if (spanContext.description) {
      this.description = spanContext.description;
    }
    if (spanContext.data) {
      this.data = spanContext.data;
    }
    if (spanContext.tags) {
      this.tags = spanContext.tags;
    }
    if (spanContext.status) {
      this.status = spanContext.status;
    }
    if (spanContext.startTimestamp) {
      this.startTimestamp = spanContext.startTimestamp;
    }
    if (spanContext.endTimestamp) {
      this.endTimestamp = spanContext.endTimestamp;
    }
    if (spanContext.instrumenter) {
      this.instrumenter = spanContext.instrumenter;
    }
  }

  /**
   * @inheritDoc
   */
   startChild(
    spanContext,
  ) {
    const childSpan = new Span({
      ...spanContext,
      parentSpanId: this.spanId,
      sampled: this.sampled,
      traceId: this.traceId,
    });

    childSpan.spanRecorder = this.spanRecorder;
    if (childSpan.spanRecorder) {
      childSpan.spanRecorder.add(childSpan);
    }

    childSpan.transaction = this.transaction;

    if ((typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && childSpan.transaction) {
      const opStr = (spanContext && spanContext.op) || '< unknown op >';
      const nameStr = childSpan.transaction.name || '< unknown name >';
      const idStr = childSpan.transaction.spanId;

      const logMessage = `[Tracing] Starting '${opStr}' span on transaction '${nameStr}' (${idStr}).`;
      childSpan.transaction.metadata.spanMetadata[childSpan.spanId] = { logMessage };
      utils.logger.log(logMessage);
    }

    return childSpan;
  }

  /**
   * @inheritDoc
   */
   setTag(key, value) {
    this.tags = { ...this.tags, [key]: value };
    return this;
  }

  /**
   * @inheritDoc
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
   setData(key, value) {
    this.data = { ...this.data, [key]: value };
    return this;
  }

  /**
   * @inheritDoc
   */
   setStatus(value) {
    this.status = value;
    return this;
  }

  /**
   * @inheritDoc
   */
   setHttpStatus(httpStatus) {
    this.setTag('http.status_code', String(httpStatus));
    const spanStatus = spanStatusfromHttpCode(httpStatus);
    if (spanStatus !== 'unknown_error') {
      this.setStatus(spanStatus);
    }
    return this;
  }

  /**
   * @inheritDoc
   */
   isSuccess() {
    return this.status === 'ok';
  }

  /**
   * @inheritDoc
   */
   finish(endTimestamp) {
    if (
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
      // Don't call this for transactions
      this.transaction &&
      this.transaction.spanId !== this.spanId
    ) {
      const { logMessage } = this.transaction.metadata.spanMetadata[this.spanId];
      if (logMessage) {
        utils.logger.log((logMessage ).replace('Starting', 'Finishing'));
      }
    }

    this.endTimestamp = typeof endTimestamp === 'number' ? endTimestamp : utils.timestampWithMs();
  }

  /**
   * @inheritDoc
   */
   toTraceparent() {
    let sampledString = '';
    if (this.sampled !== undefined) {
      sampledString = this.sampled ? '-1' : '-0';
    }
    return `${this.traceId}-${this.spanId}${sampledString}`;
  }

  /**
   * @inheritDoc
   */
   toContext() {
    return utils.dropUndefinedKeys({
      data: this.data,
      description: this.description,
      endTimestamp: this.endTimestamp,
      op: this.op,
      parentSpanId: this.parentSpanId,
      sampled: this.sampled,
      spanId: this.spanId,
      startTimestamp: this.startTimestamp,
      status: this.status,
      tags: this.tags,
      traceId: this.traceId,
    });
  }

  /**
   * @inheritDoc
   */
   updateWithContext(spanContext) {
    this.data = spanContext.data || {};
    this.description = spanContext.description;
    this.endTimestamp = spanContext.endTimestamp;
    this.op = spanContext.op;
    this.parentSpanId = spanContext.parentSpanId;
    this.sampled = spanContext.sampled;
    this.spanId = spanContext.spanId || this.spanId;
    this.startTimestamp = spanContext.startTimestamp || this.startTimestamp;
    this.status = spanContext.status;
    this.tags = spanContext.tags || {};
    this.traceId = spanContext.traceId || this.traceId;

    return this;
  }

  /**
   * @inheritDoc
   */
   getTraceContext() {
    return utils.dropUndefinedKeys({
      data: Object.keys(this.data).length > 0 ? this.data : undefined,
      description: this.description,
      op: this.op,
      parent_span_id: this.parentSpanId,
      span_id: this.spanId,
      status: this.status,
      tags: Object.keys(this.tags).length > 0 ? this.tags : undefined,
      trace_id: this.traceId,
    });
  }

  /**
   * @inheritDoc
   */
   toJSON()

 {
    return utils.dropUndefinedKeys({
      data: Object.keys(this.data).length > 0 ? this.data : undefined,
      description: this.description,
      op: this.op,
      parent_span_id: this.parentSpanId,
      span_id: this.spanId,
      start_timestamp: this.startTimestamp,
      status: this.status,
      tags: Object.keys(this.tags).length > 0 ? this.tags : undefined,
      timestamp: this.endTimestamp,
      trace_id: this.traceId,
    });
  }
}

/**
 * Converts a HTTP status code into a {@link SpanStatusType}.
 *
 * @param httpStatus The HTTP response status code.
 * @returns The span status or unknown_error.
 */
function spanStatusfromHttpCode(httpStatus) {
  if (httpStatus < 400 && httpStatus >= 100) {
    return 'ok';
  }

  if (httpStatus >= 400 && httpStatus < 500) {
    switch (httpStatus) {
      case 401:
        return 'unauthenticated';
      case 403:
        return 'permission_denied';
      case 404:
        return 'not_found';
      case 409:
        return 'already_exists';
      case 413:
        return 'failed_precondition';
      case 429:
        return 'resource_exhausted';
      default:
        return 'invalid_argument';
    }
  }

  if (httpStatus >= 500 && httpStatus < 600) {
    switch (httpStatus) {
      case 501:
        return 'unimplemented';
      case 503:
        return 'unavailable';
      case 504:
        return 'deadline_exceeded';
      default:
        return 'internal_error';
    }
  }

  return 'unknown_error';
}

exports.Span = Span;
exports.SpanRecorder = SpanRecorder;
exports.spanStatusfromHttpCode = spanStatusfromHttpCode;
//# sourceMappingURL=span.js.map


/***/ }),

/***/ 8284:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/** The status of an Span.
 *
 * @deprecated Use string literals - if you require type casting, cast to SpanStatusType type
 */
// eslint-disable-next-line import/export
exports.SpanStatus = void 0; (function (SpanStatus) {
  /** The operation completed successfully. */
  const Ok = 'ok'; SpanStatus["Ok"] = Ok;
  /** Deadline expired before operation could complete. */
  const DeadlineExceeded = 'deadline_exceeded'; SpanStatus["DeadlineExceeded"] = DeadlineExceeded;
  /** 401 Unauthorized (actually does mean unauthenticated according to RFC 7235) */
  const Unauthenticated = 'unauthenticated'; SpanStatus["Unauthenticated"] = Unauthenticated;
  /** 403 Forbidden */
  const PermissionDenied = 'permission_denied'; SpanStatus["PermissionDenied"] = PermissionDenied;
  /** 404 Not Found. Some requested entity (file or directory) was not found. */
  const NotFound = 'not_found'; SpanStatus["NotFound"] = NotFound;
  /** 429 Too Many Requests */
  const ResourceExhausted = 'resource_exhausted'; SpanStatus["ResourceExhausted"] = ResourceExhausted;
  /** Client specified an invalid argument. 4xx. */
  const InvalidArgument = 'invalid_argument'; SpanStatus["InvalidArgument"] = InvalidArgument;
  /** 501 Not Implemented */
  const Unimplemented = 'unimplemented'; SpanStatus["Unimplemented"] = Unimplemented;
  /** 503 Service Unavailable */
  const Unavailable = 'unavailable'; SpanStatus["Unavailable"] = Unavailable;
  /** Other/generic 5xx. */
  const InternalError = 'internal_error'; SpanStatus["InternalError"] = InternalError;
  /** Unknown. Any non-standard HTTP status code. */
  const UnknownError = 'unknown_error'; SpanStatus["UnknownError"] = UnknownError;
  /** The operation was cancelled (typically by the user). */
  const Cancelled = 'cancelled'; SpanStatus["Cancelled"] = Cancelled;
  /** Already exists (409) */
  const AlreadyExists = 'already_exists'; SpanStatus["AlreadyExists"] = AlreadyExists;
  /** Operation was rejected because the system is not in a state required for the operation's */
  const FailedPrecondition = 'failed_precondition'; SpanStatus["FailedPrecondition"] = FailedPrecondition;
  /** The operation was aborted, typically due to a concurrency issue. */
  const Aborted = 'aborted'; SpanStatus["Aborted"] = Aborted;
  /** Operation was attempted past the valid range. */
  const OutOfRange = 'out_of_range'; SpanStatus["OutOfRange"] = OutOfRange;
  /** Unrecoverable data loss or corruption */
  const DataLoss = 'data_loss'; SpanStatus["DataLoss"] = DataLoss;
})(exports.SpanStatus || (exports.SpanStatus = {}));
//# sourceMappingURL=spanstatus.js.map


/***/ }),

/***/ 7738:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);
const span = __webpack_require__(6776);

/** JSDoc */
class Transaction extends span.Span  {

  /**
   * The reference to the current hub.
   */

   __init() {this._measurements = {};}

   __init2() {this._contexts = {};}

   __init3() {this._frozenDynamicSamplingContext = undefined;}

  /**
   * This constructor should never be called manually. Those instrumenting tracing should use
   * `Sentry.startTransaction()`, and internal methods should use `hub.startTransaction()`.
   * @internal
   * @hideconstructor
   * @hidden
   */
   constructor(transactionContext, hub) {
    super(transactionContext);Transaction.prototype.__init.call(this);Transaction.prototype.__init2.call(this);Transaction.prototype.__init3.call(this);
    this._hub = hub || core.getCurrentHub();

    this._name = transactionContext.name || '';

    this.metadata = {
      source: 'custom',
      ...transactionContext.metadata,
      spanMetadata: {},
      changes: [],
      propagations: 0,
    };

    this._trimEnd = transactionContext.trimEnd;

    // this is because transactions are also spans, and spans have a transaction pointer
    this.transaction = this;

    // If Dynamic Sampling Context is provided during the creation of the transaction, we freeze it as it usually means
    // there is incoming Dynamic Sampling Context. (Either through an incoming request, a baggage meta-tag, or other means)
    const incomingDynamicSamplingContext = this.metadata.dynamicSamplingContext;
    if (incomingDynamicSamplingContext) {
      // We shallow copy this in case anything writes to the original reference of the passed in `dynamicSamplingContext`
      this._frozenDynamicSamplingContext = { ...incomingDynamicSamplingContext };
    }
  }

  /** Getter for `name` property */
   get name() {
    return this._name;
  }

  /** Setter for `name` property, which also sets `source` as custom */
   set name(newName) {
    this.setName(newName);
  }

  /**
   * JSDoc
   */
   setName(name, source = 'custom') {
    // `source` could change without the name changing if we discover that an unparameterized route is actually
    // parameterized by virtue of having no parameters in its path
    if (name !== this.name || source !== this.metadata.source) {
      this.metadata.changes.push({
        // log previous source
        source: this.metadata.source,
        timestamp: utils.timestampInSeconds(),
        propagations: this.metadata.propagations,
      });
    }

    this._name = name;
    this.metadata.source = source;
  }

  /**
   * Attaches SpanRecorder to the span itself
   * @param maxlen maximum number of spans that can be recorded
   */
   initSpanRecorder(maxlen = 1000) {
    if (!this.spanRecorder) {
      this.spanRecorder = new span.SpanRecorder(maxlen);
    }
    this.spanRecorder.add(this);
  }

  /**
   * @inheritDoc
   */
   setContext(key, context) {
    if (context === null) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this._contexts[key];
    } else {
      this._contexts[key] = context;
    }
  }

  /**
   * @inheritDoc
   */
   setMeasurement(name, value, unit = '') {
    this._measurements[name] = { value, unit };
  }

  /**
   * @inheritDoc
   */
   setMetadata(newMetadata) {
    this.metadata = { ...this.metadata, ...newMetadata };
  }

  /**
   * @inheritDoc
   */
   finish(endTimestamp) {
    // This transaction is already finished, so we should not flush it again.
    if (this.endTimestamp !== undefined) {
      return undefined;
    }

    if (!this.name) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.warn('Transaction has no name, falling back to `<unlabeled transaction>`.');
      this.name = '<unlabeled transaction>';
    }

    // just sets the end timestamp
    super.finish(endTimestamp);

    if (this.sampled !== true) {
      // At this point if `sampled !== true` we want to discard the transaction.
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log('[Tracing] Discarding transaction because its trace was not chosen to be sampled.');

      const client = this._hub.getClient();
      if (client) {
        client.recordDroppedEvent('sample_rate', 'transaction');
      }

      return undefined;
    }

    const finishedSpans = this.spanRecorder ? this.spanRecorder.spans.filter(s => s !== this && s.endTimestamp) : [];

    if (this._trimEnd && finishedSpans.length > 0) {
      this.endTimestamp = finishedSpans.reduce((prev, current) => {
        if (prev.endTimestamp && current.endTimestamp) {
          return prev.endTimestamp > current.endTimestamp ? prev : current;
        }
        return prev;
      }).endTimestamp;
    }

    const metadata = this.metadata;

    const transaction = {
      contexts: {
        ...this._contexts,
        // We don't want to override trace context
        trace: this.getTraceContext(),
      },
      spans: finishedSpans,
      start_timestamp: this.startTimestamp,
      tags: this.tags,
      timestamp: this.endTimestamp,
      transaction: this.name,
      type: 'transaction',
      sdkProcessingMetadata: {
        ...metadata,
        dynamicSamplingContext: this.getDynamicSamplingContext(),
      },
      ...(metadata.source && {
        transaction_info: {
          source: metadata.source,
          changes: metadata.changes,
          propagations: metadata.propagations,
        },
      }),
    };

    const hasMeasurements = Object.keys(this._measurements).length > 0;

    if (hasMeasurements) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
        utils.logger.log(
          '[Measurements] Adding measurements to transaction',
          JSON.stringify(this._measurements, undefined, 2),
        );
      transaction.measurements = this._measurements;
    }

    (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && utils.logger.log(`[Tracing] Finishing ${this.op} transaction: ${this.name}.`);

    return this._hub.captureEvent(transaction);
  }

  /**
   * @inheritDoc
   */
   toContext() {
    const spanContext = super.toContext();

    return utils.dropUndefinedKeys({
      ...spanContext,
      name: this.name,
      trimEnd: this._trimEnd,
    });
  }

  /**
   * @inheritDoc
   */
   updateWithContext(transactionContext) {
    super.updateWithContext(transactionContext);

    this.name = transactionContext.name || '';

    this._trimEnd = transactionContext.trimEnd;

    return this;
  }

  /**
   * @inheritdoc
   *
   * @experimental
   */
   getDynamicSamplingContext() {
    if (this._frozenDynamicSamplingContext) {
      return this._frozenDynamicSamplingContext;
    }

    const hub = this._hub || core.getCurrentHub();
    const client = hub && hub.getClient();

    if (!client) return {};

    const { environment, release } = client.getOptions() || {};
    const { publicKey: public_key } = client.getDsn() || {};

    const maybeSampleRate = this.metadata.sampleRate;
    const sample_rate = maybeSampleRate !== undefined ? maybeSampleRate.toString() : undefined;

    const scope = hub.getScope();
    const { segment: user_segment } = (scope && scope.getUser()) || {};

    const source = this.metadata.source;

    // We don't want to have a transaction name in the DSC if the source is "url" because URLs might contain PII
    const transaction = source && source !== 'url' ? this.name : undefined;

    const dsc = utils.dropUndefinedKeys({
      environment,
      release,
      transaction,
      user_segment,
      public_key,
      trace_id: this.traceId,
      sample_rate,
    });

    // Uncomment if we want to make DSC immutable
    // this._frozenDynamicSamplingContext = dsc;

    return dsc;
  }
}

exports.Transaction = Transaction;
//# sourceMappingURL=transaction.js.map


/***/ }),

/***/ 562:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const core = __webpack_require__(3377);
const utils = __webpack_require__(9425);

/**
 * Determines if tracing is currently enabled.
 *
 * Tracing is enabled when at least one of `tracesSampleRate` and `tracesSampler` is defined in the SDK config.
 */
function hasTracingEnabled(
  maybeOptions,
) {
  const client = core.getCurrentHub().getClient();
  const options = maybeOptions || (client && client.getOptions());
  return !!options && ('tracesSampleRate' in options || 'tracesSampler' in options);
}

/** Grabs active transaction off scope, if any */
function getActiveTransaction(maybeHub) {
  const hub = maybeHub || core.getCurrentHub();
  const scope = hub.getScope();
  return scope && (scope.getTransaction() );
}

/**
 * Converts from milliseconds to seconds
 * @param time time in ms
 */
function msToSec(time) {
  return time / 1000;
}

exports.TRACEPARENT_REGEXP = utils.TRACEPARENT_REGEXP;
exports.extractTraceparentData = utils.extractTraceparentData;
exports.stripUrlQueryAndFragment = utils.stripUrlQueryAndFragment;
exports.getActiveTransaction = getActiveTransaction;
exports.hasTracingEnabled = hasTracingEnabled;
exports.msToSec = msToSec;
//# sourceMappingURL=utils.js.map


/***/ }),

/***/ 3375:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const is = __webpack_require__(4247);
const logger = __webpack_require__(235);

const BAGGAGE_HEADER_NAME = 'baggage';

const SENTRY_BAGGAGE_KEY_PREFIX = 'sentry-';

const SENTRY_BAGGAGE_KEY_PREFIX_REGEX = /^sentry-/;

/**
 * Max length of a serialized baggage string
 *
 * https://www.w3.org/TR/baggage/#limits
 */
const MAX_BAGGAGE_STRING_LENGTH = 8192;

/**
 * Takes a baggage header and turns it into Dynamic Sampling Context, by extracting all the "sentry-" prefixed values
 * from it.
 *
 * @param baggageHeader A very bread definition of a baggage header as it might appear in various frameworks.
 * @returns The Dynamic Sampling Context that was found on `baggageHeader`, if there was any, `undefined` otherwise.
 */
function baggageHeaderToDynamicSamplingContext(
  // Very liberal definition of what any incoming header might look like
  baggageHeader,
) {
  if (!is.isString(baggageHeader) && !Array.isArray(baggageHeader)) {
    return undefined;
  }

  // Intermediary object to store baggage key value pairs of incoming baggage headers on.
  // It is later used to read Sentry-DSC-values from.
  let baggageObject = {};

  if (Array.isArray(baggageHeader)) {
    // Combine all baggage headers into one object containing the baggage values so we can later read the Sentry-DSC-values from it
    baggageObject = baggageHeader.reduce((acc, curr) => {
      const currBaggageObject = baggageHeaderToObject(curr);
      return {
        ...acc,
        ...currBaggageObject,
      };
    }, {});
  } else {
    // Return undefined if baggage header is an empty string (technically an empty baggage header is not spec conform but
    // this is how we choose to handle it)
    if (!baggageHeader) {
      return undefined;
    }

    baggageObject = baggageHeaderToObject(baggageHeader);
  }

  // Read all "sentry-" prefixed values out of the baggage object and put it onto a dynamic sampling context object.
  const dynamicSamplingContext = Object.entries(baggageObject).reduce((acc, [key, value]) => {
    if (key.match(SENTRY_BAGGAGE_KEY_PREFIX_REGEX)) {
      const nonPrefixedKey = key.slice(SENTRY_BAGGAGE_KEY_PREFIX.length);
      acc[nonPrefixedKey] = value;
    }
    return acc;
  }, {});

  // Only return a dynamic sampling context object if there are keys in it.
  // A keyless object means there were no sentry values on the header, which means that there is no DSC.
  if (Object.keys(dynamicSamplingContext).length > 0) {
    return dynamicSamplingContext ;
  } else {
    return undefined;
  }
}

/**
 * Turns a Dynamic Sampling Object into a baggage header by prefixing all the keys on the object with "sentry-".
 *
 * @param dynamicSamplingContext The Dynamic Sampling Context to turn into a header. For convenience and compatibility
 * with the `getDynamicSamplingContext` method on the Transaction class ,this argument can also be `undefined`. If it is
 * `undefined` the function will return `undefined`.
 * @returns a baggage header, created from `dynamicSamplingContext`, or `undefined` either if `dynamicSamplingContext`
 * was `undefined`, or if `dynamicSamplingContext` didn't contain any values.
 */
function dynamicSamplingContextToSentryBaggageHeader(
  // this also takes undefined for convenience and bundle size in other places
  dynamicSamplingContext,
) {
  // Prefix all DSC keys with "sentry-" and put them into a new object
  const sentryPrefixedDSC = Object.entries(dynamicSamplingContext).reduce(
    (acc, [dscKey, dscValue]) => {
      if (dscValue) {
        acc[`${SENTRY_BAGGAGE_KEY_PREFIX}${dscKey}`] = dscValue;
      }
      return acc;
    },
    {},
  );

  return objectToBaggageHeader(sentryPrefixedDSC);
}

/**
 * Will parse a baggage header, which is a simple key-value map, into a flat object.
 *
 * @param baggageHeader The baggage header to parse.
 * @returns a flat object containing all the key-value pairs from `baggageHeader`.
 */
function baggageHeaderToObject(baggageHeader) {
  return baggageHeader
    .split(',')
    .map(baggageEntry => baggageEntry.split('=').map(keyOrValue => decodeURIComponent(keyOrValue.trim())))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
}

/**
 * Turns a flat object (key-value pairs) into a baggage header, which is also just key-value pairs.
 *
 * @param object The object to turn into a baggage header.
 * @returns a baggage header string, or `undefined` if the object didn't have any values, since an empty baggage header
 * is not spec compliant.
 */
function objectToBaggageHeader(object) {
  if (Object.keys(object).length === 0) {
    // An empty baggage header is not spec compliant: We return undefined.
    return undefined;
  }

  return Object.entries(object).reduce((baggageHeader, [objectKey, objectValue], currentIndex) => {
    const baggageEntry = `${encodeURIComponent(objectKey)}=${encodeURIComponent(objectValue)}`;
    const newBaggageHeader = currentIndex === 0 ? baggageEntry : `${baggageHeader},${baggageEntry}`;
    if (newBaggageHeader.length > MAX_BAGGAGE_STRING_LENGTH) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
        logger.logger.warn(
          `Not adding key: ${objectKey} with val: ${objectValue} to baggage header due to exceeding baggage size limits.`,
        );
      return baggageHeader;
    } else {
      return newBaggageHeader;
    }
  }, '');
}

exports.BAGGAGE_HEADER_NAME = BAGGAGE_HEADER_NAME;
exports.MAX_BAGGAGE_STRING_LENGTH = MAX_BAGGAGE_STRING_LENGTH;
exports.SENTRY_BAGGAGE_KEY_PREFIX = SENTRY_BAGGAGE_KEY_PREFIX;
exports.SENTRY_BAGGAGE_KEY_PREFIX_REGEX = SENTRY_BAGGAGE_KEY_PREFIX_REGEX;
exports.baggageHeaderToDynamicSamplingContext = baggageHeaderToDynamicSamplingContext;
exports.dynamicSamplingContextToSentryBaggageHeader = dynamicSamplingContextToSentryBaggageHeader;
//# sourceMappingURL=baggage.js.map


/***/ }),

/***/ 3487:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const is = __webpack_require__(4247);
const worldwide = __webpack_require__(5362);

// eslint-disable-next-line deprecation/deprecation
const WINDOW = worldwide.getGlobalObject();

const DEFAULT_MAX_STRING_LENGTH = 80;

/**
 * Given a child DOM element, returns a query-selector statement describing that
 * and its ancestors
 * e.g. [HTMLElement] => body > div > input#foo.btn[name=baz]
 * @returns generated DOM path
 */
function htmlTreeAsString(
  elem,
  options = {},
) {

  // try/catch both:
  // - accessing event.target (see getsentry/raven-js#838, #768)
  // - `htmlTreeAsString` because it's complex, and just accessing the DOM incorrectly
  // - can throw an exception in some circumstances.
  try {
    let currentElem = elem ;
    const MAX_TRAVERSE_HEIGHT = 5;
    const out = [];
    let height = 0;
    let len = 0;
    const separator = ' > ';
    const sepLength = separator.length;
    let nextStr;
    const keyAttrs = Array.isArray(options) ? options : options.keyAttrs;
    const maxStringLength = (!Array.isArray(options) && options.maxStringLength) || DEFAULT_MAX_STRING_LENGTH;

    while (currentElem && height++ < MAX_TRAVERSE_HEIGHT) {
      nextStr = _htmlElementAsString(currentElem, keyAttrs);
      // bail out if
      // - nextStr is the 'html' element
      // - the length of the string that would be created exceeds maxStringLength
      //   (ignore this limit if we are on the first iteration)
      if (nextStr === 'html' || (height > 1 && len + out.length * sepLength + nextStr.length >= maxStringLength)) {
        break;
      }

      out.push(nextStr);

      len += nextStr.length;
      currentElem = currentElem.parentNode;
    }

    return out.reverse().join(separator);
  } catch (_oO) {
    return '<unknown>';
  }
}

/**
 * Returns a simple, query-selector representation of a DOM element
 * e.g. [HTMLElement] => input#foo.btn[name=baz]
 * @returns generated DOM path
 */
function _htmlElementAsString(el, keyAttrs) {
  const elem = el

;

  const out = [];
  let className;
  let classes;
  let key;
  let attr;
  let i;

  if (!elem || !elem.tagName) {
    return '';
  }

  out.push(elem.tagName.toLowerCase());

  // Pairs of attribute keys defined in `serializeAttribute` and their values on element.
  const keyAttrPairs =
    keyAttrs && keyAttrs.length
      ? keyAttrs.filter(keyAttr => elem.getAttribute(keyAttr)).map(keyAttr => [keyAttr, elem.getAttribute(keyAttr)])
      : null;

  if (keyAttrPairs && keyAttrPairs.length) {
    keyAttrPairs.forEach(keyAttrPair => {
      out.push(`[${keyAttrPair[0]}="${keyAttrPair[1]}"]`);
    });
  } else {
    if (elem.id) {
      out.push(`#${elem.id}`);
    }

    // eslint-disable-next-line prefer-const
    className = elem.className;
    if (className && is.isString(className)) {
      classes = className.split(/\s+/);
      for (i = 0; i < classes.length; i++) {
        out.push(`.${classes[i]}`);
      }
    }
  }
  const allowedAttrs = ['aria-label', 'type', 'name', 'title', 'alt'];
  for (i = 0; i < allowedAttrs.length; i++) {
    key = allowedAttrs[i];
    attr = elem.getAttribute(key);
    if (attr) {
      out.push(`[${key}="${attr}"]`);
    }
  }
  return out.join('');
}

/**
 * A safe form of location.href
 */
function getLocationHref() {
  try {
    return WINDOW.document.location.href;
  } catch (oO) {
    return '';
  }
}

/**
 * Gets a DOM element by using document.querySelector.
 *
 * This wrapper will first check for the existance of the function before
 * actually calling it so that we don't have to take care of this check,
 * every time we want to access the DOM.
 *
 * Reason: DOM/querySelector is not available in all environments.
 *
 * We have to cast to any because utils can be consumed by a variety of environments,
 * and we don't want to break TS users. If you know what element will be selected by
 * `document.querySelector`, specify it as part of the generic call. For example,
 * `const element = getDomElement<Element>('selector');`
 *
 * @param selector the selector string passed on to document.querySelector
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDomElement(selector) {
  if (WINDOW.document && WINDOW.document.querySelector) {
    return WINDOW.document.querySelector(selector) ;
  }
  return null;
}

exports.getDomElement = getDomElement;
exports.getLocationHref = getLocationHref;
exports.htmlTreeAsString = htmlTreeAsString;
//# sourceMappingURL=browser.js.map


/***/ }),

/***/ 7728:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const _nullishCoalesce = __webpack_require__(95);

// adapted from Sucrase (https://github.com/alangpierce/sucrase)

/**
 * Polyfill for the nullish coalescing operator (`??`), when used in situations where at least one of the values is the
 * result of an async operation.
 *
 * Note that the RHS is wrapped in a function so that if it's a computed value, that evaluation won't happen unless the
 * LHS evaluates to a nullish value, to mimic the operator's short-circuiting behavior.
 *
 * Adapted from Sucrase (https://github.com/alangpierce/sucrase)
 *
 * @param lhs The value of the expression to the left of the `??`
 * @param rhsFn A function returning the value of the expression to the right of the `??`
 * @returns The LHS value, unless it's `null` or `undefined`, in which case, the RHS value
 */
async function _asyncNullishCoalesce(lhs, rhsFn) {
  return _nullishCoalesce._nullishCoalesce(lhs, rhsFn);
}

// Sucrase version:
// async function _asyncNullishCoalesce(lhs, rhsFn) {
//   if (lhs != null) {
//     return lhs;
//   } else {
//     return await rhsFn();
//   }
// }

exports._asyncNullishCoalesce = _asyncNullishCoalesce;
//# sourceMappingURL=_asyncNullishCoalesce.js.map


/***/ }),

/***/ 2590:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Polyfill for the optional chain operator, `?.`, given previous conversion of the expression into an array of values,
 * descriptors, and functions, for situations in which at least one part of the expression is async.
 *
 * Adapted from Sucrase (https://github.com/alangpierce/sucrase) See
 * https://github.com/alangpierce/sucrase/blob/265887868966917f3b924ce38dfad01fbab1329f/src/transformers/OptionalChainingNullishTransformer.ts#L15
 *
 * @param ops Array result of expression conversion
 * @returns The value of the expression
 */
async function _asyncOptionalChain(ops) {
  let lastAccessLHS = undefined;
  let value = ops[0];
  let i = 1;
  while (i < ops.length) {
    const op = ops[i] ;
    const fn = ops[i + 1] ;
    i += 2;
    // by checking for loose equality to `null`, we catch both `null` and `undefined`
    if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) {
      // really we're meaning to return `undefined` as an actual value here, but it saves bytes not to write it
      return;
    }
    if (op === 'access' || op === 'optionalAccess') {
      lastAccessLHS = value;
      value = await fn(value);
    } else if (op === 'call' || op === 'optionalCall') {
      value = await fn((...args) => (value ).call(lastAccessLHS, ...args));
      lastAccessLHS = undefined;
    }
  }
  return value;
}

// Sucrase version:
// async function _asyncOptionalChain(ops) {
//   let lastAccessLHS = undefined;
//   let value = ops[0];
//   let i = 1;
//   while (i < ops.length) {
//     const op = ops[i];
//     const fn = ops[i + 1];
//     i += 2;
//     if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) {
//       return undefined;
//     }
//     if (op === 'access' || op === 'optionalAccess') {
//       lastAccessLHS = value;
//       value = await fn(value);
//     } else if (op === 'call' || op === 'optionalCall') {
//       value = await fn((...args) => value.call(lastAccessLHS, ...args));
//       lastAccessLHS = undefined;
//     }
//   }
//   return value;
// }

exports._asyncOptionalChain = _asyncOptionalChain;
//# sourceMappingURL=_asyncOptionalChain.js.map


/***/ }),

/***/ 3595:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const _asyncOptionalChain = __webpack_require__(2590);

/**
 * Polyfill for the optional chain operator, `?.`, given previous conversion of the expression into an array of values,
 * descriptors, and functions, in cases where the value of the expression is to be deleted.
 *
 * Adapted from Sucrase (https://github.com/alangpierce/sucrase) See
 * https://github.com/alangpierce/sucrase/blob/265887868966917f3b924ce38dfad01fbab1329f/src/transformers/OptionalChainingNullishTransformer.ts#L15
 *
 * @param ops Array result of expression conversion
 * @returns The return value of the `delete` operator: `true`, unless the deletion target is an own, non-configurable
 * property (one which can't be deleted or turned into an accessor, and whose enumerability can't be changed), in which
 * case `false`.
 */
async function _asyncOptionalChainDelete(ops) {
  const result = (await _asyncOptionalChain._asyncOptionalChain(ops)) ;
  // If `result` is `null`, it means we didn't get to the end of the chain and so nothing was deleted (in which case,
  // return `true` since that's what `delete` does when it no-ops). If it's non-null, we know the delete happened, in
  // which case we return whatever the `delete` returned, which will be a boolean.
  return result == null ? true : (result );
}

// Sucrase version:
// async function asyncOptionalChainDelete(ops) {
//   const result = await ASYNC_OPTIONAL_CHAIN_NAME(ops);
//   return result == null ? true : result;
// }

exports._asyncOptionalChainDelete = _asyncOptionalChainDelete;
//# sourceMappingURL=_asyncOptionalChainDelete.js.map


/***/ }),

/***/ 2782:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Copy a property from the given object into `exports`, under the given name.
 *
 * Adapted from Sucrase (https://github.com/alangpierce/sucrase)
 *
 * @param obj The object containing the property to copy.
 * @param localName The name under which to export the property
 * @param importedName The name under which the property lives in `obj`
 */
function _createNamedExportFrom(obj, localName, importedName) {
  exports[localName] = obj[importedName];
}

// Sucrase version:
// function _createNamedExportFrom(obj, localName, importedName) {
//   Object.defineProperty(exports, localName, {enumerable: true, get: () => obj[importedName]});
// }

exports._createNamedExportFrom = _createNamedExportFrom;
//# sourceMappingURL=_createNamedExportFrom.js.map


/***/ }),

/***/ 9186:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Copy properties from an object into `exports`.
 *
 * Adapted from Sucrase (https://github.com/alangpierce/sucrase)
 *
 * @param obj The object containing the properties to copy.
 */
function _createStarExport(obj) {
  Object.keys(obj)
    .filter(key => key !== 'default' && key !== '__esModule' && !(key in exports))
    .forEach(key => (exports[key] = obj[key]));
}

// Sucrase version:
// function _createStarExport(obj) {
//   Object.keys(obj)
//     .filter(key => key !== 'default' && key !== '__esModule')
//     .forEach(key => {
//       if (exports.hasOwnProperty(key)) {
//         return;
//       }
//       Object.defineProperty(exports, key, { enumerable: true, get: () => obj[key] });
//     });
// }

exports._createStarExport = _createStarExport;
//# sourceMappingURL=_createStarExport.js.map


/***/ }),

/***/ 6331:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Unwraps a module if it has been wrapped in an object under the key `default`.
 *
 * Adapted from Rollup (https://github.com/rollup/rollup)
 *
 * @param requireResult The result of calling `require` on a module
 * @returns The full module, unwrapped if necessary.
 */
function _interopDefault$1(requireResult) {
  return requireResult.__esModule ? (requireResult.default ) : requireResult;
}

// Rollup version:
// function _interopDefault(e) {
//   return e && e.__esModule ? e['default'] : e;
// }

exports._interopDefault = _interopDefault$1;
//# sourceMappingURL=_interopDefault.js.map


/***/ }),

/***/ 4328:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Adds a self-referential `default` property to CJS modules which aren't the result of transpilation from ESM modules.
 *
 * Adapted from Rollup (https://github.com/rollup/rollup)
 *
 * @param requireResult The result of calling `require` on a module
 * @returns Either `requireResult` or a copy of `requireResult` with an added self-referential `default` property
 */
function _interopNamespace$1(requireResult) {
  return requireResult.__esModule ? requireResult : { ...requireResult, default: requireResult };
}

// Rollup version (with `output.externalLiveBindings` and `output.freeze` both set to false)
// function _interopNamespace(e) {
//   if (e && e.__esModule) return e;
//   var n = Object.create(null);
//   if (e) {
//     for (var k in e) {
//       n[k] = e[k];
//     }
//   }
//   n["default"] = e;
//   return n;
// }

exports._interopNamespace = _interopNamespace$1;
//# sourceMappingURL=_interopNamespace.js.map


/***/ }),

/***/ 5232:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Wrap a module in an object, as the value under the key `default`.
 *
 * Adapted from Rollup (https://github.com/rollup/rollup)
 *
 * @param requireResult The result of calling `require` on a module
 * @returns An object containing the key-value pair (`default`, `requireResult`)
 */
function _interopNamespaceDefaultOnly$1(requireResult) {
  return {
    __proto__: null,
    default: requireResult,
  };
}

// Rollup version
// function _interopNamespaceDefaultOnly(e) {
//   return {
//     __proto__: null,
//     'default': e
//   };
// }

exports._interopNamespaceDefaultOnly = _interopNamespaceDefaultOnly$1;
//# sourceMappingURL=_interopNamespaceDefaultOnly.js.map


/***/ }),

/***/ 1417:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Wraps modules which aren't the result of transpiling an ESM module in an object under the key `default`
 *
 * Adapted from Sucrase (https://github.com/alangpierce/sucrase)
 *
 * @param requireResult The result of calling `require` on a module
 * @returns `requireResult` or `requireResult` wrapped in an object, keyed as `default`
 */
function _interopRequireDefault(requireResult) {
  return requireResult.__esModule ? requireResult : { default: requireResult };
}

// Sucrase version
// function _interopRequireDefault(obj) {
//   return obj && obj.__esModule ? obj : { default: obj };
// }

exports._interopRequireDefault = _interopRequireDefault;
//# sourceMappingURL=_interopRequireDefault.js.map


/***/ }),

/***/ 6965:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Adds a `default` property to CJS modules which aren't the result of transpilation from ESM modules.
 *
 * Adapted from Sucrase (https://github.com/alangpierce/sucrase)
 *
 * @param requireResult The result of calling `require` on a module
 * @returns Either `requireResult` or a copy of `requireResult` with an added self-referential `default` property
 */
function _interopRequireWildcard(requireResult) {
  return requireResult.__esModule ? requireResult : { ...requireResult, default: requireResult };
}

// Sucrase version
// function _interopRequireWildcard(obj) {
//   if (obj && obj.__esModule) {
//     return obj;
//   } else {
//     var newObj = {};
//     if (obj != null) {
//       for (var key in obj) {
//         if (Object.prototype.hasOwnProperty.call(obj, key)) {
//           newObj[key] = obj[key];
//         }
//       }
//     }
//     newObj.default = obj;
//     return newObj;
//   }
// }

exports._interopRequireWildcard = _interopRequireWildcard;
//# sourceMappingURL=_interopRequireWildcard.js.map


/***/ }),

/***/ 95:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Polyfill for the nullish coalescing operator (`??`).
 *
 * Note that the RHS is wrapped in a function so that if it's a computed value, that evaluation won't happen unless the
 * LHS evaluates to a nullish value, to mimic the operator's short-circuiting behavior.
 *
 * Adapted from Sucrase (https://github.com/alangpierce/sucrase)
 *
 * @param lhs The value of the expression to the left of the `??`
 * @param rhsFn A function returning the value of the expression to the right of the `??`
 * @returns The LHS value, unless it's `null` or `undefined`, in which case, the RHS value
 */
function _nullishCoalesce(lhs, rhsFn) {
  // by checking for loose equality to `null`, we catch both `null` and `undefined`
  return lhs != null ? lhs : rhsFn();
}

// Sucrase version:
// function _nullishCoalesce(lhs, rhsFn) {
//   if (lhs != null) {
//     return lhs;
//   } else {
//     return rhsFn();
//   }
// }

exports._nullishCoalesce = _nullishCoalesce;
//# sourceMappingURL=_nullishCoalesce.js.map


/***/ }),

/***/ 7608:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Polyfill for the optional chain operator, `?.`, given previous conversion of the expression into an array of values,
 * descriptors, and functions.
 *
 * Adapted from Sucrase (https://github.com/alangpierce/sucrase)
 * See https://github.com/alangpierce/sucrase/blob/265887868966917f3b924ce38dfad01fbab1329f/src/transformers/OptionalChainingNullishTransformer.ts#L15
 *
 * @param ops Array result of expression conversion
 * @returns The value of the expression
 */
function _optionalChain(ops) {
  let lastAccessLHS = undefined;
  let value = ops[0];
  let i = 1;
  while (i < ops.length) {
    const op = ops[i] ;
    const fn = ops[i + 1] ;
    i += 2;
    // by checking for loose equality to `null`, we catch both `null` and `undefined`
    if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) {
      // really we're meaning to return `undefined` as an actual value here, but it saves bytes not to write it
      return;
    }
    if (op === 'access' || op === 'optionalAccess') {
      lastAccessLHS = value;
      value = fn(value);
    } else if (op === 'call' || op === 'optionalCall') {
      value = fn((...args) => (value ).call(lastAccessLHS, ...args));
      lastAccessLHS = undefined;
    }
  }
  return value;
}

// Sucrase version
// function _optionalChain(ops) {
//   let lastAccessLHS = undefined;
//   let value = ops[0];
//   let i = 1;
//   while (i < ops.length) {
//     const op = ops[i];
//     const fn = ops[i + 1];
//     i += 2;
//     if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) {
//       return undefined;
//     }
//     if (op === 'access' || op === 'optionalAccess') {
//       lastAccessLHS = value;
//       value = fn(value);
//     } else if (op === 'call' || op === 'optionalCall') {
//       value = fn((...args) => value.call(lastAccessLHS, ...args));
//       lastAccessLHS = undefined;
//     }
//   }
//   return value;
// }

exports._optionalChain = _optionalChain;
//# sourceMappingURL=_optionalChain.js.map


/***/ }),

/***/ 8687:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const _optionalChain = __webpack_require__(7608);

/**
 * Polyfill for the optional chain operator, `?.`, given previous conversion of the expression into an array of values,
 * descriptors, and functions, in cases where the value of the expression is to be deleted.
 *
 * Adapted from Sucrase (https://github.com/alangpierce/sucrase) See
 * https://github.com/alangpierce/sucrase/blob/265887868966917f3b924ce38dfad01fbab1329f/src/transformers/OptionalChainingNullishTransformer.ts#L15
 *
 * @param ops Array result of expression conversion
 * @returns The return value of the `delete` operator: `true`, unless the deletion target is an own, non-configurable
 * property (one which can't be deleted or turned into an accessor, and whose enumerability can't be changed), in which
 * case `false`.
 */
function _optionalChainDelete(ops) {
  const result = _optionalChain._optionalChain(ops) ;
  // If `result` is `null`, it means we didn't get to the end of the chain and so nothing was deleted (in which case,
  // return `true` since that's what `delete` does when it no-ops). If it's non-null, we know the delete happened, in
  // which case we return whatever the `delete` returned, which will be a boolean.
  return result == null ? true : result;
}

// Sucrase version:
// function _optionalChainDelete(ops) {
//   const result = _optionalChain(ops);
//   // by checking for loose equality to `null`, we catch both `null` and `undefined`
//   return result == null ? true : result;
// }

exports._optionalChainDelete = _optionalChainDelete;
//# sourceMappingURL=_optionalChainDelete.js.map


/***/ }),

/***/ 2699:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const _asyncNullishCoalesce = __webpack_require__(7728);
const _asyncOptionalChain = __webpack_require__(2590);
const _asyncOptionalChainDelete = __webpack_require__(3595);
const _createNamedExportFrom = __webpack_require__(2782);
const _createStarExport = __webpack_require__(9186);
const _interopDefault$1 = __webpack_require__(6331);
const _interopNamespace$1 = __webpack_require__(4328);
const _interopNamespaceDefaultOnly$1 = __webpack_require__(5232);
const _interopRequireDefault = __webpack_require__(1417);
const _interopRequireWildcard = __webpack_require__(6965);
const _nullishCoalesce = __webpack_require__(95);
const _optionalChain = __webpack_require__(7608);
const _optionalChainDelete = __webpack_require__(8687);



exports._asyncNullishCoalesce = _asyncNullishCoalesce._asyncNullishCoalesce;
exports._asyncOptionalChain = _asyncOptionalChain._asyncOptionalChain;
exports._asyncOptionalChainDelete = _asyncOptionalChainDelete._asyncOptionalChainDelete;
exports._createNamedExportFrom = _createNamedExportFrom._createNamedExportFrom;
exports._createStarExport = _createStarExport._createStarExport;
exports._interopDefault = _interopDefault$1._interopDefault;
exports._interopNamespace = _interopNamespace$1._interopNamespace;
exports._interopNamespaceDefaultOnly = _interopNamespaceDefaultOnly$1._interopNamespaceDefaultOnly;
exports._interopRequireDefault = _interopRequireDefault._interopRequireDefault;
exports._interopRequireWildcard = _interopRequireWildcard._interopRequireWildcard;
exports._nullishCoalesce = _nullishCoalesce._nullishCoalesce;
exports._optionalChain = _optionalChain._optionalChain;
exports._optionalChainDelete = _optionalChainDelete._optionalChainDelete;
//# sourceMappingURL=index.js.map


/***/ }),

/***/ 1382:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const envelope = __webpack_require__(1080);
const time = __webpack_require__(4374);

/**
 * Creates client report envelope
 * @param discarded_events An array of discard events
 * @param dsn A DSN that can be set on the header. Optional.
 */
function createClientReportEnvelope(
  discarded_events,
  dsn,
  timestamp,
) {
  const clientReportItem = [
    { type: 'client_report' },
    {
      timestamp: timestamp || time.dateTimestampInSeconds(),
      discarded_events,
    },
  ];
  return envelope.createEnvelope(dsn ? { dsn } : {}, [clientReportItem]);
}

exports.createClientReportEnvelope = createClientReportEnvelope;
//# sourceMappingURL=clientreport.js.map


/***/ }),

/***/ 411:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const error = __webpack_require__(6547);

/** Regular expression used to parse a Dsn. */
const DSN_REGEX = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+)?)?@)([\w.-]+)(?::(\d+))?\/(.+)/;

function isValidProtocol(protocol) {
  return protocol === 'http' || protocol === 'https';
}

/**
 * Renders the string representation of this Dsn.
 *
 * By default, this will render the public representation without the password
 * component. To get the deprecated private representation, set `withPassword`
 * to true.
 *
 * @param withPassword When set to true, the password will be included.
 */
function dsnToString(dsn, withPassword = false) {
  const { host, path, pass, port, projectId, protocol, publicKey } = dsn;
  return (
    `${protocol}://${publicKey}${withPassword && pass ? `:${pass}` : ''}` +
    `@${host}${port ? `:${port}` : ''}/${path ? `${path}/` : path}${projectId}`
  );
}

/**
 * Parses a Dsn from a given string.
 *
 * @param str A Dsn as string
 * @returns Dsn as DsnComponents
 */
function dsnFromString(str) {
  const match = DSN_REGEX.exec(str);

  if (!match) {
    throw new error.SentryError(`Invalid Sentry Dsn: ${str}`);
  }

  const [protocol, publicKey, pass = '', host, port = '', lastPath] = match.slice(1);
  let path = '';
  let projectId = lastPath;

  const split = projectId.split('/');
  if (split.length > 1) {
    path = split.slice(0, -1).join('/');
    projectId = split.pop() ;
  }

  if (projectId) {
    const projectMatch = projectId.match(/^\d+/);
    if (projectMatch) {
      projectId = projectMatch[0];
    }
  }

  return dsnFromComponents({ host, pass, path, projectId, port, protocol: protocol , publicKey });
}

function dsnFromComponents(components) {
  return {
    protocol: components.protocol,
    publicKey: components.publicKey || '',
    pass: components.pass || '',
    host: components.host,
    port: components.port || '',
    path: components.path || '',
    projectId: components.projectId,
  };
}

function validateDsn(dsn) {
  if (!(typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__)) {
    return;
  }

  const { port, projectId, protocol } = dsn;

  const requiredComponents = ['protocol', 'publicKey', 'host', 'projectId'];
  requiredComponents.forEach(component => {
    if (!dsn[component]) {
      throw new error.SentryError(`Invalid Sentry Dsn: ${component} missing`);
    }
  });

  if (!projectId.match(/^\d+$/)) {
    throw new error.SentryError(`Invalid Sentry Dsn: Invalid projectId ${projectId}`);
  }

  if (!isValidProtocol(protocol)) {
    throw new error.SentryError(`Invalid Sentry Dsn: Invalid protocol ${protocol}`);
  }

  if (port && isNaN(parseInt(port, 10))) {
    throw new error.SentryError(`Invalid Sentry Dsn: Invalid port ${port}`);
  }

  return true;
}

/** The Sentry Dsn, identifying a Sentry instance and project. */
function makeDsn(from) {
  const components = typeof from === 'string' ? dsnFromString(from) : dsnFromComponents(from);
  validateDsn(components);
  return components;
}

exports.dsnFromString = dsnFromString;
exports.dsnToString = dsnToString;
exports.makeDsn = makeDsn;
//# sourceMappingURL=dsn.js.map


/***/ }),

/***/ 2338:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/*
 * This module exists for optimizations in the build process through rollup and terser.  We define some global
 * constants, which can be overridden during build. By guarding certain pieces of code with functions that return these
 * constants, we can control whether or not they appear in the final bundle. (Any code guarded by a false condition will
 * never run, and will hence be dropped during treeshaking.) The two primary uses for this are stripping out calls to
 * `logger` and preventing node-related code from appearing in browser bundles.
 *
 * Attention:
 * This file should not be used to define constants/flags that are intended to be used for tree-shaking conducted by
 * users. These flags should live in their respective packages, as we identified user tooling (specifically webpack)
 * having issues tree-shaking these constants across package boundaries.
 * An example for this is the __SENTRY_DEBUG__ constant. It is declared in each package individually because we want
 * users to be able to shake away expressions that it guards.
 */

/**
 * Figures out if we're building a browser bundle.
 *
 * @returns true if this is a browser bundle build.
 */
function isBrowserBundle() {
  return typeof __SENTRY_BROWSER_BUNDLE__ !== 'undefined' && !!__SENTRY_BROWSER_BUNDLE__;
}

/**
 * Get source of SDK.
 */
function getSDKSource() {
  // @ts-ignore "npm" is injected by rollup during build process
  return "npm";
}

exports.getSDKSource = getSDKSource;
exports.isBrowserBundle = isBrowserBundle;
//# sourceMappingURL=env.js.map


/***/ }),

/***/ 1080:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const dsn = __webpack_require__(411);
const normalize = __webpack_require__(5504);
const object = __webpack_require__(5646);

/**
 * Creates an envelope.
 * Make sure to always explicitly provide the generic to this function
 * so that the envelope types resolve correctly.
 */
function createEnvelope(headers, items = []) {
  return [headers, items] ;
}

/**
 * Add an item to an envelope.
 * Make sure to always explicitly provide the generic to this function
 * so that the envelope types resolve correctly.
 */
function addItemToEnvelope(envelope, newItem) {
  const [headers, items] = envelope;
  return [headers, [...items, newItem]] ;
}

/**
 * Convenience function to loop through the items and item types of an envelope.
 * (This function was mostly created because working with envelope types is painful at the moment)
 */
function forEachEnvelopeItem(
  envelope,
  callback,
) {
  const envelopeItems = envelope[1];
  envelopeItems.forEach((envelopeItem) => {
    const envelopeItemType = envelopeItem[0].type;
    callback(envelopeItem, envelopeItemType);
  });
}

/**
 * Encode a string to UTF8.
 */
function encodeUTF8(input, textEncoder) {
  const utf8 = textEncoder || new TextEncoder();
  return utf8.encode(input);
}

/**
 * Serializes an envelope.
 */
function serializeEnvelope(envelope, textEncoder) {
  const [envHeaders, items] = envelope;

  // Initially we construct our envelope as a string and only convert to binary chunks if we encounter binary data
  let parts = JSON.stringify(envHeaders);

  function append(next) {
    if (typeof parts === 'string') {
      parts = typeof next === 'string' ? parts + next : [encodeUTF8(parts, textEncoder), next];
    } else {
      parts.push(typeof next === 'string' ? encodeUTF8(next, textEncoder) : next);
    }
  }

  for (const item of items) {
    const [itemHeaders, payload] = item;

    append(`\n${JSON.stringify(itemHeaders)}\n`);

    if (typeof payload === 'string' || payload instanceof Uint8Array) {
      append(payload);
    } else {
      let stringifiedPayload;
      try {
        stringifiedPayload = JSON.stringify(payload);
      } catch (e) {
        // In case, despite all our efforts to keep `payload` circular-dependency-free, `JSON.strinify()` still
        // fails, we try again after normalizing it again with infinite normalization depth. This of course has a
        // performance impact but in this case a performance hit is better than throwing.
        stringifiedPayload = JSON.stringify(normalize.normalize(payload));
      }
      append(stringifiedPayload);
    }
  }

  return typeof parts === 'string' ? parts : concatBuffers(parts);
}

function concatBuffers(buffers) {
  const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);

  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    merged.set(buffer, offset);
    offset += buffer.length;
  }

  return merged;
}

/**
 * Parses an envelope
 */
function parseEnvelope(
  env,
  textEncoder,
  textDecoder,
) {
  let buffer = typeof env === 'string' ? textEncoder.encode(env) : env;

  function readBinary(length) {
    const bin = buffer.subarray(0, length);
    // Replace the buffer with the remaining data excluding trailing newline
    buffer = buffer.subarray(length + 1);
    return bin;
  }

  function readJson() {
    let i = buffer.indexOf(0xa);
    // If we couldn't find a newline, we must have found the end of the buffer
    if (i < 0) {
      i = buffer.length;
    }

    return JSON.parse(textDecoder.decode(readBinary(i))) ;
  }

  const envelopeHeader = readJson();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = [];

  while (buffer.length) {
    const itemHeader = readJson();
    const binaryLength = typeof itemHeader.length === 'number' ? itemHeader.length : undefined;

    items.push([itemHeader, binaryLength ? readBinary(binaryLength) : readJson()]);
  }

  return [envelopeHeader, items];
}

/**
 * Creates attachment envelope items
 */
function createAttachmentEnvelopeItem(
  attachment,
  textEncoder,
) {
  const buffer = typeof attachment.data === 'string' ? encodeUTF8(attachment.data, textEncoder) : attachment.data;

  return [
    object.dropUndefinedKeys({
      type: 'attachment',
      length: buffer.length,
      filename: attachment.filename,
      content_type: attachment.contentType,
      attachment_type: attachment.attachmentType,
    }),
    buffer,
  ];
}

const ITEM_TYPE_TO_DATA_CATEGORY_MAP = {
  session: 'session',
  sessions: 'session',
  attachment: 'attachment',
  transaction: 'transaction',
  event: 'error',
  client_report: 'internal',
  user_report: 'default',
  profile: 'profile',
  replay_event: 'replay',
  replay_recording: 'replay',
};

/**
 * Maps the type of an envelope item to a data category.
 */
function envelopeItemTypeToDataCategory(type) {
  return ITEM_TYPE_TO_DATA_CATEGORY_MAP[type];
}

/** Extracts the minimal SDK info from from the metadata or an events */
function getSdkMetadataForEnvelopeHeader(metadataOrEvent) {
  if (!metadataOrEvent || !metadataOrEvent.sdk) {
    return;
  }
  const { name, version } = metadataOrEvent.sdk;
  return { name, version };
}

/**
 * Creates event envelope headers, based on event, sdk info and tunnel
 * Note: This function was extracted from the core package to make it available in Replay
 */
function createEventEnvelopeHeaders(
  event,
  sdkInfo,
  tunnel,
  dsn$1,
) {
  const dynamicSamplingContext = event.sdkProcessingMetadata && event.sdkProcessingMetadata.dynamicSamplingContext;

  return {
    event_id: event.event_id ,
    sent_at: new Date().toISOString(),
    ...(sdkInfo && { sdk: sdkInfo }),
    ...(!!tunnel && { dsn: dsn.dsnToString(dsn$1) }),
    ...(event.type === 'transaction' &&
      dynamicSamplingContext && {
        trace: object.dropUndefinedKeys({ ...dynamicSamplingContext }),
      }),
  };
}

exports.addItemToEnvelope = addItemToEnvelope;
exports.createAttachmentEnvelopeItem = createAttachmentEnvelopeItem;
exports.createEnvelope = createEnvelope;
exports.createEventEnvelopeHeaders = createEventEnvelopeHeaders;
exports.envelopeItemTypeToDataCategory = envelopeItemTypeToDataCategory;
exports.forEachEnvelopeItem = forEachEnvelopeItem;
exports.getSdkMetadataForEnvelopeHeader = getSdkMetadataForEnvelopeHeader;
exports.parseEnvelope = parseEnvelope;
exports.serializeEnvelope = serializeEnvelope;
//# sourceMappingURL=envelope.js.map


/***/ }),

/***/ 6547:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/** An error emitted by Sentry SDKs and related utilities. */
class SentryError extends Error {
  /** Display name of this error instance. */

   constructor( message, logLevel = 'warn') {
    super(message);this.message = message;
    this.name = new.target.prototype.constructor.name;
    // This sets the prototype to be `Error`, not `SentryError`. It's unclear why we do this, but commenting this line
    // out causes various (seemingly totally unrelated) playwright tests consistently time out. FYI, this makes
    // instances of `SentryError` fail `obj instanceof SentryError` checks.
    Object.setPrototypeOf(this, new.target.prototype);
    this.logLevel = logLevel;
  }
}

exports.SentryError = SentryError;
//# sourceMappingURL=error.js.map


/***/ }),

/***/ 9425:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const browser = __webpack_require__(3487);
const dsn = __webpack_require__(411);
const error = __webpack_require__(6547);
const worldwide = __webpack_require__(5362);
const instrument = __webpack_require__(4616);
const is = __webpack_require__(4247);
const logger = __webpack_require__(235);
const memo = __webpack_require__(4986);
const misc = __webpack_require__(6651);
const node = __webpack_require__(5197);
const normalize = __webpack_require__(5504);
const object = __webpack_require__(5646);
const path = __webpack_require__(5808);
const promisebuffer = __webpack_require__(9469);
const requestdata = __webpack_require__(4510);
const severity = __webpack_require__(2685);
const stacktrace = __webpack_require__(4867);
const string = __webpack_require__(255);
const supports = __webpack_require__(2163);
const syncpromise = __webpack_require__(5174);
const time = __webpack_require__(4374);
const tracing = __webpack_require__(8211);
const env = __webpack_require__(2338);
const envelope = __webpack_require__(1080);
const clientreport = __webpack_require__(1382);
const ratelimit = __webpack_require__(5211);
const baggage = __webpack_require__(3375);
const url = __webpack_require__(9317);



exports.getDomElement = browser.getDomElement;
exports.getLocationHref = browser.getLocationHref;
exports.htmlTreeAsString = browser.htmlTreeAsString;
exports.dsnFromString = dsn.dsnFromString;
exports.dsnToString = dsn.dsnToString;
exports.makeDsn = dsn.makeDsn;
exports.SentryError = error.SentryError;
exports.GLOBAL_OBJ = worldwide.GLOBAL_OBJ;
exports.getGlobalObject = worldwide.getGlobalObject;
exports.getGlobalSingleton = worldwide.getGlobalSingleton;
exports.addInstrumentationHandler = instrument.addInstrumentationHandler;
exports.isDOMError = is.isDOMError;
exports.isDOMException = is.isDOMException;
exports.isElement = is.isElement;
exports.isError = is.isError;
exports.isErrorEvent = is.isErrorEvent;
exports.isEvent = is.isEvent;
exports.isInstanceOf = is.isInstanceOf;
exports.isNaN = is.isNaN;
exports.isPlainObject = is.isPlainObject;
exports.isPrimitive = is.isPrimitive;
exports.isRegExp = is.isRegExp;
exports.isString = is.isString;
exports.isSyntheticEvent = is.isSyntheticEvent;
exports.isThenable = is.isThenable;
exports.CONSOLE_LEVELS = logger.CONSOLE_LEVELS;
exports.consoleSandbox = logger.consoleSandbox;
Object.defineProperty(exports, "logger", ({
	enumerable: true,
	get: () => logger.logger
}));
exports.memoBuilder = memo.memoBuilder;
exports.addContextToFrame = misc.addContextToFrame;
exports.addExceptionMechanism = misc.addExceptionMechanism;
exports.addExceptionTypeValue = misc.addExceptionTypeValue;
exports.arrayify = misc.arrayify;
exports.checkOrSetAlreadyCaught = misc.checkOrSetAlreadyCaught;
exports.getEventDescription = misc.getEventDescription;
exports.parseSemver = misc.parseSemver;
exports.uuid4 = misc.uuid4;
exports.dynamicRequire = node.dynamicRequire;
exports.isNodeEnv = node.isNodeEnv;
exports.loadModule = node.loadModule;
exports.normalize = normalize.normalize;
exports.normalizeToSize = normalize.normalizeToSize;
exports.walk = normalize.walk;
exports.addNonEnumerableProperty = object.addNonEnumerableProperty;
exports.convertToPlainObject = object.convertToPlainObject;
exports.dropUndefinedKeys = object.dropUndefinedKeys;
exports.extractExceptionKeysForMessage = object.extractExceptionKeysForMessage;
exports.fill = object.fill;
exports.getOriginalFunction = object.getOriginalFunction;
exports.markFunctionWrapped = object.markFunctionWrapped;
exports.objectify = object.objectify;
exports.urlEncode = object.urlEncode;
exports.basename = path.basename;
exports.dirname = path.dirname;
exports.isAbsolute = path.isAbsolute;
exports.join = path.join;
exports.normalizePath = path.normalizePath;
exports.relative = path.relative;
exports.resolve = path.resolve;
exports.makePromiseBuffer = promisebuffer.makePromiseBuffer;
exports.addRequestDataToEvent = requestdata.addRequestDataToEvent;
exports.addRequestDataToTransaction = requestdata.addRequestDataToTransaction;
exports.extractPathForTransaction = requestdata.extractPathForTransaction;
exports.extractRequestData = requestdata.extractRequestData;
exports.severityFromString = severity.severityFromString;
exports.severityLevelFromString = severity.severityLevelFromString;
exports.validSeverityLevels = severity.validSeverityLevels;
exports.createStackParser = stacktrace.createStackParser;
exports.getFunctionName = stacktrace.getFunctionName;
exports.nodeStackLineParser = stacktrace.nodeStackLineParser;
exports.stackParserFromStackParserOptions = stacktrace.stackParserFromStackParserOptions;
exports.stripSentryFramesAndReverse = stacktrace.stripSentryFramesAndReverse;
exports.escapeStringForRegex = string.escapeStringForRegex;
exports.isMatchingPattern = string.isMatchingPattern;
exports.safeJoin = string.safeJoin;
exports.snipLine = string.snipLine;
exports.stringMatchesSomePattern = string.stringMatchesSomePattern;
exports.truncate = string.truncate;
exports.isNativeFetch = supports.isNativeFetch;
exports.supportsDOMError = supports.supportsDOMError;
exports.supportsDOMException = supports.supportsDOMException;
exports.supportsErrorEvent = supports.supportsErrorEvent;
exports.supportsFetch = supports.supportsFetch;
exports.supportsHistory = supports.supportsHistory;
exports.supportsNativeFetch = supports.supportsNativeFetch;
exports.supportsReferrerPolicy = supports.supportsReferrerPolicy;
exports.supportsReportingObserver = supports.supportsReportingObserver;
exports.SyncPromise = syncpromise.SyncPromise;
exports.rejectedSyncPromise = syncpromise.rejectedSyncPromise;
exports.resolvedSyncPromise = syncpromise.resolvedSyncPromise;
Object.defineProperty(exports, "_browserPerformanceTimeOriginMode", ({
	enumerable: true,
	get: () => time._browserPerformanceTimeOriginMode
}));
exports.browserPerformanceTimeOrigin = time.browserPerformanceTimeOrigin;
exports.dateTimestampInSeconds = time.dateTimestampInSeconds;
exports.timestampInSeconds = time.timestampInSeconds;
exports.timestampWithMs = time.timestampWithMs;
exports.usingPerformanceAPI = time.usingPerformanceAPI;
exports.TRACEPARENT_REGEXP = tracing.TRACEPARENT_REGEXP;
exports.extractTraceparentData = tracing.extractTraceparentData;
exports.getSDKSource = env.getSDKSource;
exports.isBrowserBundle = env.isBrowserBundle;
exports.addItemToEnvelope = envelope.addItemToEnvelope;
exports.createAttachmentEnvelopeItem = envelope.createAttachmentEnvelopeItem;
exports.createEnvelope = envelope.createEnvelope;
exports.createEventEnvelopeHeaders = envelope.createEventEnvelopeHeaders;
exports.envelopeItemTypeToDataCategory = envelope.envelopeItemTypeToDataCategory;
exports.forEachEnvelopeItem = envelope.forEachEnvelopeItem;
exports.getSdkMetadataForEnvelopeHeader = envelope.getSdkMetadataForEnvelopeHeader;
exports.parseEnvelope = envelope.parseEnvelope;
exports.serializeEnvelope = envelope.serializeEnvelope;
exports.createClientReportEnvelope = clientreport.createClientReportEnvelope;
exports.DEFAULT_RETRY_AFTER = ratelimit.DEFAULT_RETRY_AFTER;
exports.disabledUntil = ratelimit.disabledUntil;
exports.isRateLimited = ratelimit.isRateLimited;
exports.parseRetryAfterHeader = ratelimit.parseRetryAfterHeader;
exports.updateRateLimits = ratelimit.updateRateLimits;
exports.BAGGAGE_HEADER_NAME = baggage.BAGGAGE_HEADER_NAME;
exports.MAX_BAGGAGE_STRING_LENGTH = baggage.MAX_BAGGAGE_STRING_LENGTH;
exports.SENTRY_BAGGAGE_KEY_PREFIX = baggage.SENTRY_BAGGAGE_KEY_PREFIX;
exports.SENTRY_BAGGAGE_KEY_PREFIX_REGEX = baggage.SENTRY_BAGGAGE_KEY_PREFIX_REGEX;
exports.baggageHeaderToDynamicSamplingContext = baggage.baggageHeaderToDynamicSamplingContext;
exports.dynamicSamplingContextToSentryBaggageHeader = baggage.dynamicSamplingContextToSentryBaggageHeader;
exports.getNumberOfUrlSegments = url.getNumberOfUrlSegments;
exports.parseUrl = url.parseUrl;
exports.stripUrlQueryAndFragment = url.stripUrlQueryAndFragment;
//# sourceMappingURL=index.js.map


/***/ }),

/***/ 4616:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const is = __webpack_require__(4247);
const logger = __webpack_require__(235);
const object = __webpack_require__(5646);
const stacktrace = __webpack_require__(4867);
const supports = __webpack_require__(2163);
const worldwide = __webpack_require__(5362);

// eslint-disable-next-line deprecation/deprecation
const WINDOW = worldwide.getGlobalObject();

/**
 * Instrument native APIs to call handlers that can be used to create breadcrumbs, APM spans etc.
 *  - Console API
 *  - Fetch API
 *  - XHR API
 *  - History API
 *  - DOM API (click/typing)
 *  - Error API
 *  - UnhandledRejection API
 */

const handlers = {};
const instrumented = {};

/** Instruments given API */
function instrument(type) {
  if (instrumented[type]) {
    return;
  }

  instrumented[type] = true;

  switch (type) {
    case 'console':
      instrumentConsole();
      break;
    case 'dom':
      instrumentDOM();
      break;
    case 'xhr':
      instrumentXHR();
      break;
    case 'fetch':
      instrumentFetch();
      break;
    case 'history':
      instrumentHistory();
      break;
    case 'error':
      instrumentError();
      break;
    case 'unhandledrejection':
      instrumentUnhandledRejection();
      break;
    default:
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) && logger.logger.warn('unknown instrumentation type:', type);
      return;
  }
}

/**
 * Add handler that will be called when given type of instrumentation triggers.
 * Use at your own risk, this might break without changelog notice, only used internally.
 * @hidden
 */
function addInstrumentationHandler(type, callback) {
  handlers[type] = handlers[type] || [];
  (handlers[type] ).push(callback);
  instrument(type);
}

/** JSDoc */
function triggerHandlers(type, data) {
  if (!type || !handlers[type]) {
    return;
  }

  for (const handler of handlers[type] || []) {
    try {
      handler(data);
    } catch (e) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
        logger.logger.error(
          `Error while triggering instrumentation handler.\nType: ${type}\nName: ${stacktrace.getFunctionName(handler)}\nError:`,
          e,
        );
    }
  }
}

/** JSDoc */
function instrumentConsole() {
  if (!('console' in WINDOW)) {
    return;
  }

  logger.CONSOLE_LEVELS.forEach(function (level) {
    if (!(level in WINDOW.console)) {
      return;
    }

    object.fill(WINDOW.console, level, function (originalConsoleMethod) {
      return function (...args) {
        triggerHandlers('console', { args, level });

        // this fails for some browsers. :(
        if (originalConsoleMethod) {
          originalConsoleMethod.apply(WINDOW.console, args);
        }
      };
    });
  });
}

/** JSDoc */
function instrumentFetch() {
  if (!supports.supportsNativeFetch()) {
    return;
  }

  object.fill(WINDOW, 'fetch', function (originalFetch) {
    return function (...args) {
      const handlerData = {
        args,
        fetchData: {
          method: getFetchMethod(args),
          url: getFetchUrl(args),
        },
        startTimestamp: Date.now(),
      };

      triggerHandlers('fetch', {
        ...handlerData,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return originalFetch.apply(WINDOW, args).then(
        (response) => {
          triggerHandlers('fetch', {
            ...handlerData,
            endTimestamp: Date.now(),
            response,
          });
          return response;
        },
        (error) => {
          triggerHandlers('fetch', {
            ...handlerData,
            endTimestamp: Date.now(),
            error,
          });
          // NOTE: If you are a Sentry user, and you are seeing this stack frame,
          //       it means the sentry.javascript SDK caught an error invoking your application code.
          //       This is expected behavior and NOT indicative of a bug with sentry.javascript.
          throw error;
        },
      );
    };
  });
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/** Extract `method` from fetch call arguments */
function getFetchMethod(fetchArgs = []) {
  if ('Request' in WINDOW && is.isInstanceOf(fetchArgs[0], Request) && fetchArgs[0].method) {
    return String(fetchArgs[0].method).toUpperCase();
  }
  if (fetchArgs[1] && fetchArgs[1].method) {
    return String(fetchArgs[1].method).toUpperCase();
  }
  return 'GET';
}

/** Extract `url` from fetch call arguments */
function getFetchUrl(fetchArgs = []) {
  if (typeof fetchArgs[0] === 'string') {
    return fetchArgs[0];
  }
  if ('Request' in WINDOW && is.isInstanceOf(fetchArgs[0], Request)) {
    return fetchArgs[0].url;
  }
  return String(fetchArgs[0]);
}
/* eslint-enable @typescript-eslint/no-unsafe-member-access */

/** JSDoc */
function instrumentXHR() {
  if (!('XMLHttpRequest' in WINDOW)) {
    return;
  }

  const xhrproto = XMLHttpRequest.prototype;

  object.fill(xhrproto, 'open', function (originalOpen) {
    return function ( ...args) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const xhr = this;
      const url = args[1];
      const xhrInfo = (xhr.__sentry_xhr__ = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        method: is.isString(args[0]) ? args[0].toUpperCase() : args[0],
        url: args[1],
      });

      // if Sentry key appears in URL, don't capture it as a request
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (is.isString(url) && xhrInfo.method === 'POST' && url.match(/sentry_key/)) {
        xhr.__sentry_own_request__ = true;
      }

      const onreadystatechangeHandler = function () {
        if (xhr.readyState === 4) {
          try {
            // touching statusCode in some platforms throws
            // an exception
            xhrInfo.status_code = xhr.status;
          } catch (e) {
            /* do nothing */
          }

          triggerHandlers('xhr', {
            args,
            endTimestamp: Date.now(),
            startTimestamp: Date.now(),
            xhr,
          });
        }
      };

      if ('onreadystatechange' in xhr && typeof xhr.onreadystatechange === 'function') {
        object.fill(xhr, 'onreadystatechange', function (original) {
          return function (...readyStateArgs) {
            onreadystatechangeHandler();
            return original.apply(xhr, readyStateArgs);
          };
        });
      } else {
        xhr.addEventListener('readystatechange', onreadystatechangeHandler);
      }

      return originalOpen.apply(xhr, args);
    };
  });

  object.fill(xhrproto, 'send', function (originalSend) {
    return function ( ...args) {
      if (this.__sentry_xhr__ && args[0] !== undefined) {
        this.__sentry_xhr__.body = args[0];
      }

      triggerHandlers('xhr', {
        args,
        startTimestamp: Date.now(),
        xhr: this,
      });

      return originalSend.apply(this, args);
    };
  });
}

let lastHref;

/** JSDoc */
function instrumentHistory() {
  if (!supports.supportsHistory()) {
    return;
  }

  const oldOnPopState = WINDOW.onpopstate;
  WINDOW.onpopstate = function ( ...args) {
    const to = WINDOW.location.href;
    // keep track of the current URL state, as we always receive only the updated state
    const from = lastHref;
    lastHref = to;
    triggerHandlers('history', {
      from,
      to,
    });
    if (oldOnPopState) {
      // Apparently this can throw in Firefox when incorrectly implemented plugin is installed.
      // https://github.com/getsentry/sentry-javascript/issues/3344
      // https://github.com/bugsnag/bugsnag-js/issues/469
      try {
        return oldOnPopState.apply(this, args);
      } catch (_oO) {
        // no-empty
      }
    }
  };

  /** @hidden */
  function historyReplacementFunction(originalHistoryFunction) {
    return function ( ...args) {
      const url = args.length > 2 ? args[2] : undefined;
      if (url) {
        // coerce to string (this is what pushState does)
        const from = lastHref;
        const to = String(url);
        // keep track of the current URL state, as we always receive only the updated state
        lastHref = to;
        triggerHandlers('history', {
          from,
          to,
        });
      }
      return originalHistoryFunction.apply(this, args);
    };
  }

  object.fill(WINDOW.history, 'pushState', historyReplacementFunction);
  object.fill(WINDOW.history, 'replaceState', historyReplacementFunction);
}

const debounceDuration = 1000;
let debounceTimerID;
let lastCapturedEvent;

/**
 * Decide whether the current event should finish the debounce of previously captured one.
 * @param previous previously captured event
 * @param current event to be captured
 */
function shouldShortcircuitPreviousDebounce(previous, current) {
  // If there was no previous event, it should always be swapped for the new one.
  if (!previous) {
    return true;
  }

  // If both events have different type, then user definitely performed two separate actions. e.g. click + keypress.
  if (previous.type !== current.type) {
    return true;
  }

  try {
    // If both events have the same type, it's still possible that actions were performed on different targets.
    // e.g. 2 clicks on different buttons.
    if (previous.target !== current.target) {
      return true;
    }
  } catch (e) {
    // just accessing `target` property can throw an exception in some rare circumstances
    // see: https://github.com/getsentry/sentry-javascript/issues/838
  }

  // If both events have the same type _and_ same `target` (an element which triggered an event, _not necessarily_
  // to which an event listener was attached), we treat them as the same action, as we want to capture
  // only one breadcrumb. e.g. multiple clicks on the same button, or typing inside a user input box.
  return false;
}

/**
 * Decide whether an event should be captured.
 * @param event event to be captured
 */
function shouldSkipDOMEvent(event) {
  // We are only interested in filtering `keypress` events for now.
  if (event.type !== 'keypress') {
    return false;
  }

  try {
    const target = event.target ;

    if (!target || !target.tagName) {
      return true;
    }

    // Only consider keypress events on actual input elements. This will disregard keypresses targeting body
    // e.g.tabbing through elements, hotkeys, etc.
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return false;
    }
  } catch (e) {
    // just accessing `target` property can throw an exception in some rare circumstances
    // see: https://github.com/getsentry/sentry-javascript/issues/838
  }

  return true;
}

/**
 * Wraps addEventListener to capture UI breadcrumbs
 * @param handler function that will be triggered
 * @param globalListener indicates whether event was captured by the global event listener
 * @returns wrapped breadcrumb events handler
 * @hidden
 */
function makeDOMEventHandler(handler, globalListener = false) {
  return (event) => {
    // It's possible this handler might trigger multiple times for the same
    // event (e.g. event propagation through node ancestors).
    // Ignore if we've already captured that event.
    if (!event || lastCapturedEvent === event) {
      return;
    }

    // We always want to skip _some_ events.
    if (shouldSkipDOMEvent(event)) {
      return;
    }

    const name = event.type === 'keypress' ? 'input' : event.type;

    // If there is no debounce timer, it means that we can safely capture the new event and store it for future comparisons.
    if (debounceTimerID === undefined) {
      handler({
        event: event,
        name,
        global: globalListener,
      });
      lastCapturedEvent = event;
    }
    // If there is a debounce awaiting, see if the new event is different enough to treat it as a unique one.
    // If that's the case, emit the previous event and store locally the newly-captured DOM event.
    else if (shouldShortcircuitPreviousDebounce(lastCapturedEvent, event)) {
      handler({
        event: event,
        name,
        global: globalListener,
      });
      lastCapturedEvent = event;
    }

    // Start a new debounce timer that will prevent us from capturing multiple events that should be grouped together.
    clearTimeout(debounceTimerID);
    debounceTimerID = WINDOW.setTimeout(() => {
      debounceTimerID = undefined;
    }, debounceDuration);
  };
}

/** JSDoc */
function instrumentDOM() {
  if (!('document' in WINDOW)) {
    return;
  }

  // Make it so that any click or keypress that is unhandled / bubbled up all the way to the document triggers our dom
  // handlers. (Normally we have only one, which captures a breadcrumb for each click or keypress.) Do this before
  // we instrument `addEventListener` so that we don't end up attaching this handler twice.
  const triggerDOMHandler = triggerHandlers.bind(null, 'dom');
  const globalDOMEventHandler = makeDOMEventHandler(triggerDOMHandler, true);
  WINDOW.document.addEventListener('click', globalDOMEventHandler, false);
  WINDOW.document.addEventListener('keypress', globalDOMEventHandler, false);

  // After hooking into click and keypress events bubbled up to `document`, we also hook into user-handled
  // clicks & keypresses, by adding an event listener of our own to any element to which they add a listener. That
  // way, whenever one of their handlers is triggered, ours will be, too. (This is needed because their handler
  // could potentially prevent the event from bubbling up to our global listeners. This way, our handler are still
  // guaranteed to fire at least once.)
  ['EventTarget', 'Node'].forEach((target) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const proto = (WINDOW )[target] && (WINDOW )[target].prototype;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, no-prototype-builtins
    if (!proto || !proto.hasOwnProperty || !proto.hasOwnProperty('addEventListener')) {
      return;
    }

    object.fill(proto, 'addEventListener', function (originalAddEventListener) {
      return function (

        type,
        listener,
        options,
      ) {
        if (type === 'click' || type == 'keypress') {
          try {
            const el = this ;
            const handlers = (el.__sentry_instrumentation_handlers__ = el.__sentry_instrumentation_handlers__ || {});
            const handlerForType = (handlers[type] = handlers[type] || { refCount: 0 });

            if (!handlerForType.handler) {
              const handler = makeDOMEventHandler(triggerDOMHandler);
              handlerForType.handler = handler;
              originalAddEventListener.call(this, type, handler, options);
            }

            handlerForType.refCount++;
          } catch (e) {
            // Accessing dom properties is always fragile.
            // Also allows us to skip `addEventListenrs` calls with no proper `this` context.
          }
        }

        return originalAddEventListener.call(this, type, listener, options);
      };
    });

    object.fill(
      proto,
      'removeEventListener',
      function (originalRemoveEventListener) {
        return function (

          type,
          listener,
          options,
        ) {
          if (type === 'click' || type == 'keypress') {
            try {
              const el = this ;
              const handlers = el.__sentry_instrumentation_handlers__ || {};
              const handlerForType = handlers[type];

              if (handlerForType) {
                handlerForType.refCount--;
                // If there are no longer any custom handlers of the current type on this element, we can remove ours, too.
                if (handlerForType.refCount <= 0) {
                  originalRemoveEventListener.call(this, type, handlerForType.handler, options);
                  handlerForType.handler = undefined;
                  delete handlers[type]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
                }

                // If there are no longer any custom handlers of any type on this element, cleanup everything.
                if (Object.keys(handlers).length === 0) {
                  delete el.__sentry_instrumentation_handlers__;
                }
              }
            } catch (e) {
              // Accessing dom properties is always fragile.
              // Also allows us to skip `addEventListenrs` calls with no proper `this` context.
            }
          }

          return originalRemoveEventListener.call(this, type, listener, options);
        };
      },
    );
  });
}

let _oldOnErrorHandler = null;
/** JSDoc */
function instrumentError() {
  _oldOnErrorHandler = WINDOW.onerror;

  WINDOW.onerror = function (msg, url, line, column, error) {
    triggerHandlers('error', {
      column,
      error,
      line,
      msg,
      url,
    });

    if (_oldOnErrorHandler) {
      // eslint-disable-next-line prefer-rest-params
      return _oldOnErrorHandler.apply(this, arguments);
    }

    return false;
  };
}

let _oldOnUnhandledRejectionHandler = null;
/** JSDoc */
function instrumentUnhandledRejection() {
  _oldOnUnhandledRejectionHandler = WINDOW.onunhandledrejection;

  WINDOW.onunhandledrejection = function (e) {
    triggerHandlers('unhandledrejection', e);

    if (_oldOnUnhandledRejectionHandler) {
      // eslint-disable-next-line prefer-rest-params
      return _oldOnUnhandledRejectionHandler.apply(this, arguments);
    }

    return true;
  };
}

exports.addInstrumentationHandler = addInstrumentationHandler;
//# sourceMappingURL=instrument.js.map


/***/ }),

/***/ 4247:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

// eslint-disable-next-line @typescript-eslint/unbound-method
const objectToString = Object.prototype.toString;

/**
 * Checks whether given value's type is one of a few Error or Error-like
 * {@link isError}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isError(wat) {
  switch (objectToString.call(wat)) {
    case '[object Error]':
    case '[object Exception]':
    case '[object DOMException]':
      return true;
    default:
      return isInstanceOf(wat, Error);
  }
}
/**
 * Checks whether given value is an instance of the given built-in class.
 *
 * @param wat The value to be checked
 * @param className
 * @returns A boolean representing the result.
 */
function isBuiltin(wat, className) {
  return objectToString.call(wat) === `[object ${className}]`;
}

/**
 * Checks whether given value's type is ErrorEvent
 * {@link isErrorEvent}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isErrorEvent(wat) {
  return isBuiltin(wat, 'ErrorEvent');
}

/**
 * Checks whether given value's type is DOMError
 * {@link isDOMError}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isDOMError(wat) {
  return isBuiltin(wat, 'DOMError');
}

/**
 * Checks whether given value's type is DOMException
 * {@link isDOMException}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isDOMException(wat) {
  return isBuiltin(wat, 'DOMException');
}

/**
 * Checks whether given value's type is a string
 * {@link isString}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isString(wat) {
  return isBuiltin(wat, 'String');
}

/**
 * Checks whether given value is a primitive (undefined, null, number, boolean, string, bigint, symbol)
 * {@link isPrimitive}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isPrimitive(wat) {
  return wat === null || (typeof wat !== 'object' && typeof wat !== 'function');
}

/**
 * Checks whether given value's type is an object literal
 * {@link isPlainObject}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isPlainObject(wat) {
  return isBuiltin(wat, 'Object');
}

/**
 * Checks whether given value's type is an Event instance
 * {@link isEvent}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isEvent(wat) {
  return typeof Event !== 'undefined' && isInstanceOf(wat, Event);
}

/**
 * Checks whether given value's type is an Element instance
 * {@link isElement}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isElement(wat) {
  return typeof Element !== 'undefined' && isInstanceOf(wat, Element);
}

/**
 * Checks whether given value's type is an regexp
 * {@link isRegExp}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isRegExp(wat) {
  return isBuiltin(wat, 'RegExp');
}

/**
 * Checks whether given value has a then function.
 * @param wat A value to be checked.
 */
function isThenable(wat) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return Boolean(wat && wat.then && typeof wat.then === 'function');
}

/**
 * Checks whether given value's type is a SyntheticEvent
 * {@link isSyntheticEvent}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isSyntheticEvent(wat) {
  return isPlainObject(wat) && 'nativeEvent' in wat && 'preventDefault' in wat && 'stopPropagation' in wat;
}

/**
 * Checks whether given value is NaN
 * {@link isNaN}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isNaN(wat) {
  return typeof wat === 'number' && wat !== wat;
}

/**
 * Checks whether given value's type is an instance of provided constructor.
 * {@link isInstanceOf}.
 *
 * @param wat A value to be checked.
 * @param base A constructor to be used in a check.
 * @returns A boolean representing the result.
 */
function isInstanceOf(wat, base) {
  try {
    return wat instanceof base;
  } catch (_e) {
    return false;
  }
}

exports.isDOMError = isDOMError;
exports.isDOMException = isDOMException;
exports.isElement = isElement;
exports.isError = isError;
exports.isErrorEvent = isErrorEvent;
exports.isEvent = isEvent;
exports.isInstanceOf = isInstanceOf;
exports.isNaN = isNaN;
exports.isPlainObject = isPlainObject;
exports.isPrimitive = isPrimitive;
exports.isRegExp = isRegExp;
exports.isString = isString;
exports.isSyntheticEvent = isSyntheticEvent;
exports.isThenable = isThenable;
//# sourceMappingURL=is.js.map


/***/ }),

/***/ 235:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const worldwide = __webpack_require__(5362);

/** Prefix for logging strings */
const PREFIX = 'Sentry Logger ';

const CONSOLE_LEVELS = ['debug', 'info', 'warn', 'error', 'log', 'assert', 'trace'] ;

/**
 * Temporarily disable sentry console instrumentations.
 *
 * @param callback The function to run against the original `console` messages
 * @returns The results of the callback
 */
function consoleSandbox(callback) {
  if (!('console' in worldwide.GLOBAL_OBJ)) {
    return callback();
  }

  const originalConsole = worldwide.GLOBAL_OBJ.console ;
  const wrappedLevels = {};

  // Restore all wrapped console methods
  CONSOLE_LEVELS.forEach(level => {
    // TODO(v7): Remove this check as it's only needed for Node 6
    const originalWrappedFunc =
      originalConsole[level] && (originalConsole[level] ).__sentry_original__;
    if (level in originalConsole && originalWrappedFunc) {
      wrappedLevels[level] = originalConsole[level] ;
      originalConsole[level] = originalWrappedFunc ;
    }
  });

  try {
    return callback();
  } finally {
    // Revert restoration to wrapped state
    Object.keys(wrappedLevels).forEach(level => {
      originalConsole[level] = wrappedLevels[level ];
    });
  }
}

function makeLogger() {
  let enabled = false;
  const logger = {
    enable: () => {
      enabled = true;
    },
    disable: () => {
      enabled = false;
    },
  };

  if ((typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__)) {
    CONSOLE_LEVELS.forEach(name => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger[name] = (...args) => {
        if (enabled) {
          consoleSandbox(() => {
            worldwide.GLOBAL_OBJ.console[name](`${PREFIX}[${name}]:`, ...args);
          });
        }
      };
    });
  } else {
    CONSOLE_LEVELS.forEach(name => {
      logger[name] = () => undefined;
    });
  }

  return logger ;
}

// Ensure we only have a single logger instance, even if multiple versions of @sentry/utils are being used
exports.logger = void 0;
if ((typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__)) {
  exports.logger = worldwide.getGlobalSingleton('logger', makeLogger);
} else {
  exports.logger = makeLogger();
}

exports.CONSOLE_LEVELS = CONSOLE_LEVELS;
exports.consoleSandbox = consoleSandbox;
//# sourceMappingURL=logger.js.map


/***/ }),

/***/ 4986:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Helper to decycle json objects
 */
function memoBuilder() {
  const hasWeakSet = typeof WeakSet === 'function';
  const inner = hasWeakSet ? new WeakSet() : [];
  function memoize(obj) {
    if (hasWeakSet) {
      if (inner.has(obj)) {
        return true;
      }
      inner.add(obj);
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < inner.length; i++) {
      const value = inner[i];
      if (value === obj) {
        return true;
      }
    }
    inner.push(obj);
    return false;
  }

  function unmemoize(obj) {
    if (hasWeakSet) {
      inner.delete(obj);
    } else {
      for (let i = 0; i < inner.length; i++) {
        if (inner[i] === obj) {
          inner.splice(i, 1);
          break;
        }
      }
    }
  }
  return [memoize, unmemoize];
}

exports.memoBuilder = memoBuilder;
//# sourceMappingURL=memo.js.map


/***/ }),

/***/ 6651:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const object = __webpack_require__(5646);
const string = __webpack_require__(255);
const worldwide = __webpack_require__(5362);

/**
 * UUID4 generator
 *
 * @returns string Generated UUID4.
 */
function uuid4() {
  const gbl = worldwide.GLOBAL_OBJ ;
  const crypto = gbl.crypto || gbl.msCrypto;

  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }

  const getRandomByte =
    crypto && crypto.getRandomValues ? () => crypto.getRandomValues(new Uint8Array(1))[0] : () => Math.random() * 16;

  // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
  // Concatenating the following numbers as strings results in '10000000100040008000100000000000'
  return (([1e7] ) + 1e3 + 4e3 + 8e3 + 1e11).replace(/[018]/g, c =>
    // eslint-disable-next-line no-bitwise
    ((c ) ^ ((getRandomByte() & 15) >> ((c ) / 4))).toString(16),
  );
}

function getFirstException(event) {
  return event.exception && event.exception.values ? event.exception.values[0] : undefined;
}

/**
 * Extracts either message or type+value from an event that can be used for user-facing logs
 * @returns event's description
 */
function getEventDescription(event) {
  const { message, event_id: eventId } = event;
  if (message) {
    return message;
  }

  const firstException = getFirstException(event);
  if (firstException) {
    if (firstException.type && firstException.value) {
      return `${firstException.type}: ${firstException.value}`;
    }
    return firstException.type || firstException.value || eventId || '<unknown>';
  }
  return eventId || '<unknown>';
}

/**
 * Adds exception values, type and value to an synthetic Exception.
 * @param event The event to modify.
 * @param value Value of the exception.
 * @param type Type of the exception.
 * @hidden
 */
function addExceptionTypeValue(event, value, type) {
  const exception = (event.exception = event.exception || {});
  const values = (exception.values = exception.values || []);
  const firstException = (values[0] = values[0] || {});
  if (!firstException.value) {
    firstException.value = value || '';
  }
  if (!firstException.type) {
    firstException.type = type || 'Error';
  }
}

/**
 * Adds exception mechanism data to a given event. Uses defaults if the second parameter is not passed.
 *
 * @param event The event to modify.
 * @param newMechanism Mechanism data to add to the event.
 * @hidden
 */
function addExceptionMechanism(event, newMechanism) {
  const firstException = getFirstException(event);
  if (!firstException) {
    return;
  }

  const defaultMechanism = { type: 'generic', handled: true };
  const currentMechanism = firstException.mechanism;
  firstException.mechanism = { ...defaultMechanism, ...currentMechanism, ...newMechanism };

  if (newMechanism && 'data' in newMechanism) {
    const mergedData = { ...(currentMechanism && currentMechanism.data), ...newMechanism.data };
    firstException.mechanism.data = mergedData;
  }
}

// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const SEMVER_REGEXP =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Represents Semantic Versioning object
 */

/**
 * Parses input into a SemVer interface
 * @param input string representation of a semver version
 */
function parseSemver(input) {
  const match = input.match(SEMVER_REGEXP) || [];
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  return {
    buildmetadata: match[5],
    major: isNaN(major) ? undefined : major,
    minor: isNaN(minor) ? undefined : minor,
    patch: isNaN(patch) ? undefined : patch,
    prerelease: match[4],
  };
}

/**
 * This function adds context (pre/post/line) lines to the provided frame
 *
 * @param lines string[] containing all lines
 * @param frame StackFrame that will be mutated
 * @param linesOfContext number of context lines we want to add pre/post
 */
function addContextToFrame(lines, frame, linesOfContext = 5) {
  // When there is no line number in the frame, attaching context is nonsensical and will even break grouping
  if (frame.lineno === undefined) {
    return;
  }

  const maxLines = lines.length;
  const sourceLine = Math.max(Math.min(maxLines, frame.lineno - 1), 0);

  frame.pre_context = lines
    .slice(Math.max(0, sourceLine - linesOfContext), sourceLine)
    .map((line) => string.snipLine(line, 0));

  frame.context_line = string.snipLine(lines[Math.min(maxLines - 1, sourceLine)], frame.colno || 0);

  frame.post_context = lines
    .slice(Math.min(sourceLine + 1, maxLines), sourceLine + 1 + linesOfContext)
    .map((line) => string.snipLine(line, 0));
}

/**
 * Checks whether or not we've already captured the given exception (note: not an identical exception - the very object
 * in question), and marks it captured if not.
 *
 * This is useful because it's possible for an error to get captured by more than one mechanism. After we intercept and
 * record an error, we rethrow it (assuming we've intercepted it before it's reached the top-level global handlers), so
 * that we don't interfere with whatever effects the error might have had were the SDK not there. At that point, because
 * the error has been rethrown, it's possible for it to bubble up to some other code we've instrumented. If it's not
 * caught after that, it will bubble all the way up to the global handlers (which of course we also instrument). This
 * function helps us ensure that even if we encounter the same error more than once, we only record it the first time we
 * see it.
 *
 * Note: It will ignore primitives (always return `false` and not mark them as seen), as properties can't be set on
 * them. {@link: Object.objectify} can be used on exceptions to convert any that are primitives into their equivalent
 * object wrapper forms so that this check will always work. However, because we need to flag the exact object which
 * will get rethrown, and because that rethrowing happens outside of the event processing pipeline, the objectification
 * must be done before the exception captured.
 *
 * @param A thrown exception to check or flag as having been seen
 * @returns `true` if the exception has already been captured, `false` if not (with the side effect of marking it seen)
 */
function checkOrSetAlreadyCaught(exception) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (exception && (exception ).__sentry_captured__) {
    return true;
  }

  try {
    // set it this way rather than by assignment so that it's not ennumerable and therefore isn't recorded by the
    // `ExtraErrorData` integration
    object.addNonEnumerableProperty(exception , '__sentry_captured__', true);
  } catch (err) {
    // `exception` is a primitive, so we can't mark it seen
  }

  return false;
}

/**
 * Checks whether the given input is already an array, and if it isn't, wraps it in one.
 *
 * @param maybeArray Input to turn into an array, if necessary
 * @returns The input, if already an array, or an array with the input as the only element, if not
 */
function arrayify(maybeArray) {
  return Array.isArray(maybeArray) ? maybeArray : [maybeArray];
}

exports.addContextToFrame = addContextToFrame;
exports.addExceptionMechanism = addExceptionMechanism;
exports.addExceptionTypeValue = addExceptionTypeValue;
exports.arrayify = arrayify;
exports.checkOrSetAlreadyCaught = checkOrSetAlreadyCaught;
exports.getEventDescription = getEventDescription;
exports.parseSemver = parseSemver;
exports.uuid4 = uuid4;
//# sourceMappingURL=misc.js.map


/***/ }),

/***/ 5197:
/***/ ((module, exports, __webpack_require__) => {

/* module decorator */ module = __webpack_require__.nmd(module);
Object.defineProperty(exports, "__esModule", ({ value: true }));

const env = __webpack_require__(2338);

/**
 * NOTE: In order to avoid circular dependencies, if you add a function to this module and it needs to print something,
 * you must either a) use `console.log` rather than the logger, or b) put your function elsewhere.
 */

/**
 * Checks whether we're in the Node.js or Browser environment
 *
 * @returns Answer to given question
 */
function isNodeEnv() {
  // explicitly check for browser bundles as those can be optimized statically
  // by terser/rollup.
  return (
    !env.isBrowserBundle() &&
    Object.prototype.toString.call(typeof process !== 'undefined' ? process : 0) === '[object process]'
  );
}

/**
 * Requires a module which is protected against bundler minification.
 *
 * @param request The module path to resolve
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
function dynamicRequire(mod, request) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return mod.require(request);
}

/**
 * Helper for dynamically loading module that should work with linked dependencies.
 * The problem is that we _should_ be using `require(require.resolve(moduleName, { paths: [cwd()] }))`
 * However it's _not possible_ to do that with Webpack, as it has to know all the dependencies during
 * build time. `require.resolve` is also not available in any other way, so we cannot create,
 * a fake helper like we do with `dynamicRequire`.
 *
 * We always prefer to use local package, thus the value is not returned early from each `try/catch` block.
 * That is to mimic the behavior of `require.resolve` exactly.
 *
 * @param moduleName module name to require
 * @returns possibly required module
 */
function loadModule(moduleName) {
  let mod;

  try {
    mod = dynamicRequire(module, moduleName);
  } catch (e) {
    // no-empty
  }

  try {
    const { cwd } = dynamicRequire(module, 'process');
    mod = dynamicRequire(module, `${cwd()}/node_modules/${moduleName}`) ;
  } catch (e) {
    // no-empty
  }

  return mod;
}

exports.dynamicRequire = dynamicRequire;
exports.isNodeEnv = isNodeEnv;
exports.loadModule = loadModule;
//# sourceMappingURL=node.js.map


/***/ }),

/***/ 5504:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const is = __webpack_require__(4247);
const memo = __webpack_require__(4986);
const object = __webpack_require__(5646);
const stacktrace = __webpack_require__(4867);

/**
 * Recursively normalizes the given object.
 *
 * - Creates a copy to prevent original input mutation
 * - Skips non-enumerable properties
 * - When stringifying, calls `toJSON` if implemented
 * - Removes circular references
 * - Translates non-serializable values (`undefined`/`NaN`/functions) to serializable format
 * - Translates known global objects/classes to a string representations
 * - Takes care of `Error` object serialization
 * - Optionally limits depth of final output
 * - Optionally limits number of properties/elements included in any single object/array
 *
 * @param input The object to be normalized.
 * @param depth The max depth to which to normalize the object. (Anything deeper stringified whole.)
 * @param maxProperties The max number of elements or properties to be included in any single array or
 * object in the normallized output.
 * @returns A normalized version of the object, or `"**non-serializable**"` if any errors are thrown during normalization.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(input, depth = +Infinity, maxProperties = +Infinity) {
  try {
    // since we're at the outermost level, we don't provide a key
    return visit('', input, depth, maxProperties);
  } catch (err) {
    return { ERROR: `**non-serializable** (${err})` };
  }
}

/** JSDoc */
function normalizeToSize(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  object,
  // Default Node.js REPL depth
  depth = 3,
  // 100kB, as 200kB is max payload size, so half sounds reasonable
  maxSize = 100 * 1024,
) {
  const normalized = normalize(object, depth);

  if (jsonSize(normalized) > maxSize) {
    return normalizeToSize(object, depth - 1, maxSize);
  }

  return normalized ;
}

/**
 * Visits a node to perform normalization on it
 *
 * @param key The key corresponding to the given node
 * @param value The node to be visited
 * @param depth Optional number indicating the maximum recursion depth
 * @param maxProperties Optional maximum number of properties/elements included in any single object/array
 * @param memo Optional Memo class handling decycling
 */
function visit(
  key,
  value,
  depth = +Infinity,
  maxProperties = +Infinity,
  memo$1 = memo.memoBuilder(),
) {
  const [memoize, unmemoize] = memo$1;

  // Get the simple cases out of the way first
  if (value === null || (['number', 'boolean', 'string'].includes(typeof value) && !is.isNaN(value))) {
    return value ;
  }

  const stringified = stringifyValue(key, value);

  // Anything we could potentially dig into more (objects or arrays) will have come back as `"[object XXXX]"`.
  // Everything else will have already been serialized, so if we don't see that pattern, we're done.
  if (!stringified.startsWith('[object ')) {
    return stringified;
  }

  // From here on, we can assert that `value` is either an object or an array.

  // Do not normalize objects that we know have already been normalized. As a general rule, the
  // "__sentry_skip_normalization__" property should only be used sparingly and only should only be set on objects that
  // have already been normalized.
  if ((value )['__sentry_skip_normalization__']) {
    return value ;
  }

  // We're also done if we've reached the max depth
  if (depth === 0) {
    // At this point we know `serialized` is a string of the form `"[object XXXX]"`. Clean it up so it's just `"[XXXX]"`.
    return stringified.replace('object ', '');
  }

  // If we've already visited this branch, bail out, as it's circular reference. If not, note that we're seeing it now.
  if (memoize(value)) {
    return '[Circular ~]';
  }

  // If the value has a `toJSON` method, we call it to extract more information
  const valueWithToJSON = value ;
  if (valueWithToJSON && typeof valueWithToJSON.toJSON === 'function') {
    try {
      const jsonValue = valueWithToJSON.toJSON();
      // We need to normalize the return value of `.toJSON()` in case it has circular references
      return visit('', jsonValue, depth - 1, maxProperties, memo$1);
    } catch (err) {
      // pass (The built-in `toJSON` failed, but we can still try to do it ourselves)
    }
  }

  // At this point we know we either have an object or an array, we haven't seen it before, and we're going to recurse
  // because we haven't yet reached the max depth. Create an accumulator to hold the results of visiting each
  // property/entry, and keep track of the number of items we add to it.
  const normalized = (Array.isArray(value) ? [] : {}) ;
  let numAdded = 0;

  // Before we begin, convert`Error` and`Event` instances into plain objects, since some of each of their relevant
  // properties are non-enumerable and otherwise would get missed.
  const visitable = object.convertToPlainObject(value );

  for (const visitKey in visitable) {
    // Avoid iterating over fields in the prototype if they've somehow been exposed to enumeration.
    if (!Object.prototype.hasOwnProperty.call(visitable, visitKey)) {
      continue;
    }

    if (numAdded >= maxProperties) {
      normalized[visitKey] = '[MaxProperties ~]';
      break;
    }

    // Recursively visit all the child nodes
    const visitValue = visitable[visitKey];
    normalized[visitKey] = visit(visitKey, visitValue, depth - 1, maxProperties, memo$1);

    numAdded++;
  }

  // Once we've visited all the branches, remove the parent from memo storage
  unmemoize(value);

  // Return accumulated values
  return normalized;
}

/**
 * Stringify the given value. Handles various known special values and types.
 *
 * Not meant to be used on simple primitives which already have a string representation, as it will, for example, turn
 * the number 1231 into "[Object Number]", nor on `null`, as it will throw.
 *
 * @param value The value to stringify
 * @returns A stringified representation of the given value
 */
function stringifyValue(
  key,
  // this type is a tiny bit of a cheat, since this function does handle NaN (which is technically a number), but for
  // our internal use, it'll do
  value,
) {
  try {
    if (key === 'domain' && value && typeof value === 'object' && (value )._events) {
      return '[Domain]';
    }

    if (key === 'domainEmitter') {
      return '[DomainEmitter]';
    }

    // It's safe to use `global`, `window`, and `document` here in this manner, as we are asserting using `typeof` first
    // which won't throw if they are not present.

    if (typeof global !== 'undefined' && value === global) {
      return '[Global]';
    }

    // eslint-disable-next-line no-restricted-globals
    if (typeof window !== 'undefined' && value === window) {
      return '[Window]';
    }

    // eslint-disable-next-line no-restricted-globals
    if (typeof document !== 'undefined' && value === document) {
      return '[Document]';
    }

    // React's SyntheticEvent thingy
    if (is.isSyntheticEvent(value)) {
      return '[SyntheticEvent]';
    }

    if (typeof value === 'number' && value !== value) {
      return '[NaN]';
    }

    // this catches `undefined` (but not `null`, which is a primitive and can be serialized on its own)
    if (value === void 0) {
      return '[undefined]';
    }

    if (typeof value === 'function') {
      return `[Function: ${stacktrace.getFunctionName(value)}]`;
    }

    if (typeof value === 'symbol') {
      return `[${String(value)}]`;
    }

    // stringified BigInts are indistinguishable from regular numbers, so we need to label them to avoid confusion
    if (typeof value === 'bigint') {
      return `[BigInt: ${String(value)}]`;
    }

    // Now that we've knocked out all the special cases and the primitives, all we have left are objects. Simply casting
    // them to strings means that instances of classes which haven't defined their `toStringTag` will just come out as
    // `"[object Object]"`. If we instead look at the constructor's name (which is the same as the name of the class),
    // we can make sure that only plain objects come out that way.
    return `[object ${getConstructorName(value)}]`;
  } catch (err) {
    return `**non-serializable** (${err})`;
  }
}

function getConstructorName(value) {
  const prototype = Object.getPrototypeOf(value);

  return prototype ? prototype.constructor.name : 'null prototype';
}

/** Calculates bytes size of input string */
function utf8Length(value) {
  // eslint-disable-next-line no-bitwise
  return ~-encodeURI(value).split(/%..|./).length;
}

/** Calculates bytes size of input object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonSize(value) {
  return utf8Length(JSON.stringify(value));
}

exports.normalize = normalize;
exports.normalizeToSize = normalizeToSize;
exports.walk = visit;
//# sourceMappingURL=normalize.js.map


/***/ }),

/***/ 5646:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const browser = __webpack_require__(3487);
const is = __webpack_require__(4247);
const string = __webpack_require__(255);

/**
 * Replace a method in an object with a wrapped version of itself.
 *
 * @param source An object that contains a method to be wrapped.
 * @param name The name of the method to be wrapped.
 * @param replacementFactory A higher-order function that takes the original version of the given method and returns a
 * wrapped version. Note: The function returned by `replacementFactory` needs to be a non-arrow function, in order to
 * preserve the correct value of `this`, and the original method must be called using `origMethod.call(this, <other
 * args>)` or `origMethod.apply(this, [<other args>])` (rather than being called directly), again to preserve `this`.
 * @returns void
 */
function fill(source, name, replacementFactory) {
  if (!(name in source)) {
    return;
  }

  const original = source[name] ;
  const wrapped = replacementFactory(original) ;

  // Make sure it's a function first, as we need to attach an empty prototype for `defineProperties` to work
  // otherwise it'll throw "TypeError: Object.defineProperties called on non-object"
  if (typeof wrapped === 'function') {
    try {
      markFunctionWrapped(wrapped, original);
    } catch (_Oo) {
      // This can throw if multiple fill happens on a global object like XMLHttpRequest
      // Fixes https://github.com/getsentry/sentry-javascript/issues/2043
    }
  }

  source[name] = wrapped;
}

/**
 * Defines a non-enumerable property on the given object.
 *
 * @param obj The object on which to set the property
 * @param name The name of the property to be set
 * @param value The value to which to set the property
 */
function addNonEnumerableProperty(obj, name, value) {
  Object.defineProperty(obj, name, {
    // enumerable: false, // the default, so we can save on bundle size by not explicitly setting it
    value: value,
    writable: true,
    configurable: true,
  });
}

/**
 * Remembers the original function on the wrapped function and
 * patches up the prototype.
 *
 * @param wrapped the wrapper function
 * @param original the original function that gets wrapped
 */
function markFunctionWrapped(wrapped, original) {
  const proto = original.prototype || {};
  wrapped.prototype = original.prototype = proto;
  addNonEnumerableProperty(wrapped, '__sentry_original__', original);
}

/**
 * This extracts the original function if available.  See
 * `markFunctionWrapped` for more information.
 *
 * @param func the function to unwrap
 * @returns the unwrapped version of the function if available.
 */
function getOriginalFunction(func) {
  return func.__sentry_original__;
}

/**
 * Encodes given object into url-friendly format
 *
 * @param object An object that contains serializable values
 * @returns string Encoded
 */
function urlEncode(object) {
  return Object.keys(object)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(object[key])}`)
    .join('&');
}

/**
 * Transforms any `Error` or `Event` into a plain object with all of their enumerable properties, and some of their
 * non-enumerable properties attached.
 *
 * @param value Initial source that we have to transform in order for it to be usable by the serializer
 * @returns An Event or Error turned into an object - or the value argurment itself, when value is neither an Event nor
 *  an Error.
 */
function convertToPlainObject(value)

 {
  if (is.isError(value)) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
      ...getOwnProperties(value),
    };
  } else if (is.isEvent(value)) {
    const newObj

 = {
      type: value.type,
      target: serializeEventTarget(value.target),
      currentTarget: serializeEventTarget(value.currentTarget),
      ...getOwnProperties(value),
    };

    if (typeof CustomEvent !== 'undefined' && is.isInstanceOf(value, CustomEvent)) {
      newObj.detail = value.detail;
    }

    return newObj;
  } else {
    return value;
  }
}

/** Creates a string representation of the target of an `Event` object */
function serializeEventTarget(target) {
  try {
    return is.isElement(target) ? browser.htmlTreeAsString(target) : Object.prototype.toString.call(target);
  } catch (_oO) {
    return '<unknown>';
  }
}

/** Filters out all but an object's own properties */
function getOwnProperties(obj) {
  if (typeof obj === 'object' && obj !== null) {
    const extractedProps = {};
    for (const property in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, property)) {
        extractedProps[property] = (obj )[property];
      }
    }
    return extractedProps;
  } else {
    return {};
  }
}

/**
 * Given any captured exception, extract its keys and create a sorted
 * and truncated list that will be used inside the event message.
 * eg. `Non-error exception captured with keys: foo, bar, baz`
 */
function extractExceptionKeysForMessage(exception, maxLength = 40) {
  const keys = Object.keys(convertToPlainObject(exception));
  keys.sort();

  if (!keys.length) {
    return '[object has no keys]';
  }

  if (keys[0].length >= maxLength) {
    return string.truncate(keys[0], maxLength);
  }

  for (let includedKeys = keys.length; includedKeys > 0; includedKeys--) {
    const serialized = keys.slice(0, includedKeys).join(', ');
    if (serialized.length > maxLength) {
      continue;
    }
    if (includedKeys === keys.length) {
      return serialized;
    }
    return string.truncate(serialized, maxLength);
  }

  return '';
}

/**
 * Given any object, return a new object having removed all fields whose value was `undefined`.
 * Works recursively on objects and arrays.
 *
 * Attention: This function keeps circular references in the returned object.
 */
function dropUndefinedKeys(inputValue) {
  // This map keeps track of what already visited nodes map to.
  // Our Set - based memoBuilder doesn't work here because we want to the output object to have the same circular
  // references as the input object.
  const memoizationMap = new Map();

  // This function just proxies `_dropUndefinedKeys` to keep the `memoBuilder` out of this function's API
  return _dropUndefinedKeys(inputValue, memoizationMap);
}

function _dropUndefinedKeys(inputValue, memoizationMap) {
  if (is.isPlainObject(inputValue)) {
    // If this node has already been visited due to a circular reference, return the object it was mapped to in the new object
    const memoVal = memoizationMap.get(inputValue);
    if (memoVal !== undefined) {
      return memoVal ;
    }

    const returnValue = {};
    // Store the mapping of this value in case we visit it again, in case of circular data
    memoizationMap.set(inputValue, returnValue);

    for (const key of Object.keys(inputValue)) {
      if (typeof inputValue[key] !== 'undefined') {
        returnValue[key] = _dropUndefinedKeys(inputValue[key], memoizationMap);
      }
    }

    return returnValue ;
  }

  if (Array.isArray(inputValue)) {
    // If this node has already been visited due to a circular reference, return the array it was mapped to in the new object
    const memoVal = memoizationMap.get(inputValue);
    if (memoVal !== undefined) {
      return memoVal ;
    }

    const returnValue = [];
    // Store the mapping of this value in case we visit it again, in case of circular data
    memoizationMap.set(inputValue, returnValue);

    inputValue.forEach((item) => {
      returnValue.push(_dropUndefinedKeys(item, memoizationMap));
    });

    return returnValue ;
  }

  return inputValue;
}

/**
 * Ensure that something is an object.
 *
 * Turns `undefined` and `null` into `String`s and all other primitives into instances of their respective wrapper
 * classes (String, Boolean, Number, etc.). Acts as the identity function on non-primitives.
 *
 * @param wat The subject of the objectification
 * @returns A version of `wat` which can safely be used with `Object` class methods
 */
function objectify(wat) {
  let objectified;
  switch (true) {
    case wat === undefined || wat === null:
      objectified = new String(wat);
      break;

    // Though symbols and bigints do have wrapper classes (`Symbol` and `BigInt`, respectively), for whatever reason
    // those classes don't have constructors which can be used with the `new` keyword. We therefore need to cast each as
    // an object in order to wrap it.
    case typeof wat === 'symbol' || typeof wat === 'bigint':
      objectified = Object(wat);
      break;

    // this will catch the remaining primitives: `String`, `Number`, and `Boolean`
    case is.isPrimitive(wat):
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      objectified = new (wat ).constructor(wat);
      break;

    // by process of elimination, at this point we know that `wat` must already be an object
    default:
      objectified = wat;
      break;
  }
  return objectified;
}

exports.addNonEnumerableProperty = addNonEnumerableProperty;
exports.convertToPlainObject = convertToPlainObject;
exports.dropUndefinedKeys = dropUndefinedKeys;
exports.extractExceptionKeysForMessage = extractExceptionKeysForMessage;
exports.fill = fill;
exports.getOriginalFunction = getOriginalFunction;
exports.markFunctionWrapped = markFunctionWrapped;
exports.objectify = objectify;
exports.urlEncode = urlEncode;
//# sourceMappingURL=object.js.map


/***/ }),

/***/ 5808:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

// Slightly modified (no IE8 support, ES6) and transcribed to TypeScript
// https://raw.githubusercontent.com/calvinmetcalf/rollup-plugin-node-builtins/master/src/es6/path.js

/** JSDoc */
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  let up = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
const splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^/]+?|)(\.[^./]*|))(?:[/]*)$/;
/** JSDoc */
function splitPath(filename) {
  const parts = splitPathRe.exec(filename);
  return parts ? parts.slice(1) : [];
}

// path.resolve([from ...], to)
// posix version
/** JSDoc */
function resolve(...args) {
  let resolvedPath = '';
  let resolvedAbsolute = false;

  for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    const path = i >= 0 ? args[i] : '/';

    // Skip empty entries
    if (!path) {
      continue;
    }

    resolvedPath = `${path}/${resolvedPath}`;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(
    resolvedPath.split('/').filter(p => !!p),
    !resolvedAbsolute,
  ).join('/');

  return (resolvedAbsolute ? '/' : '') + resolvedPath || '.';
}

/** JSDoc */
function trim(arr) {
  let start = 0;
  for (; start < arr.length; start++) {
    if (arr[start] !== '') {
      break;
    }
  }

  let end = arr.length - 1;
  for (; end >= 0; end--) {
    if (arr[end] !== '') {
      break;
    }
  }

  if (start > end) {
    return [];
  }
  return arr.slice(start, end - start + 1);
}

// path.relative(from, to)
// posix version
/** JSDoc */
function relative(from, to) {
  /* eslint-disable no-param-reassign */
  from = resolve(from).slice(1);
  to = resolve(to).slice(1);
  /* eslint-enable no-param-reassign */

  const fromParts = trim(from.split('/'));
  const toParts = trim(to.split('/'));

  const length = Math.min(fromParts.length, toParts.length);
  let samePartsLength = length;
  for (let i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  let outputParts = [];
  for (let i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
}

// path.normalize(path)
// posix version
/** JSDoc */
function normalizePath(path) {
  const isPathAbsolute = isAbsolute(path);
  const trailingSlash = path.slice(-1) === '/';

  // Normalize the path
  let normalizedPath = normalizeArray(
    path.split('/').filter(p => !!p),
    !isPathAbsolute,
  ).join('/');

  if (!normalizedPath && !isPathAbsolute) {
    normalizedPath = '.';
  }
  if (normalizedPath && trailingSlash) {
    normalizedPath += '/';
  }

  return (isPathAbsolute ? '/' : '') + normalizedPath;
}

// posix version
/** JSDoc */
function isAbsolute(path) {
  return path.charAt(0) === '/';
}

// posix version
/** JSDoc */
function join(...args) {
  return normalizePath(args.join('/'));
}

/** JSDoc */
function dirname(path) {
  const result = splitPath(path);
  const root = result[0];
  let dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.slice(0, dir.length - 1);
  }

  return root + dir;
}

/** JSDoc */
function basename(path, ext) {
  let f = splitPath(path)[2];
  if (ext && f.slice(ext.length * -1) === ext) {
    f = f.slice(0, f.length - ext.length);
  }
  return f;
}

exports.basename = basename;
exports.dirname = dirname;
exports.isAbsolute = isAbsolute;
exports.join = join;
exports.normalizePath = normalizePath;
exports.relative = relative;
exports.resolve = resolve;
//# sourceMappingURL=path.js.map


/***/ }),

/***/ 9469:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const error = __webpack_require__(6547);
const syncpromise = __webpack_require__(5174);

/**
 * Creates an new PromiseBuffer object with the specified limit
 * @param limit max number of promises that can be stored in the buffer
 */
function makePromiseBuffer(limit) {
  const buffer = [];

  function isReady() {
    return limit === undefined || buffer.length < limit;
  }

  /**
   * Remove a promise from the queue.
   *
   * @param task Can be any PromiseLike<T>
   * @returns Removed promise.
   */
  function remove(task) {
    return buffer.splice(buffer.indexOf(task), 1)[0];
  }

  /**
   * Add a promise (representing an in-flight action) to the queue, and set it to remove itself on fulfillment.
   *
   * @param taskProducer A function producing any PromiseLike<T>; In previous versions this used to be `task:
   *        PromiseLike<T>`, but under that model, Promises were instantly created on the call-site and their executor
   *        functions therefore ran immediately. Thus, even if the buffer was full, the action still happened. By
   *        requiring the promise to be wrapped in a function, we can defer promise creation until after the buffer
   *        limit check.
   * @returns The original promise.
   */
  function add(taskProducer) {
    if (!isReady()) {
      return syncpromise.rejectedSyncPromise(new error.SentryError('Not adding Promise because buffer limit was reached.'));
    }

    // start the task and add its promise to the queue
    const task = taskProducer();
    if (buffer.indexOf(task) === -1) {
      buffer.push(task);
    }
    void task
      .then(() => remove(task))
      // Use `then(null, rejectionHandler)` rather than `catch(rejectionHandler)` so that we can use `PromiseLike`
      // rather than `Promise`. `PromiseLike` doesn't have a `.catch` method, making its polyfill smaller. (ES5 didn't
      // have promises, so TS has to polyfill when down-compiling.)
      .then(null, () =>
        remove(task).then(null, () => {
          // We have to add another catch here because `remove()` starts a new promise chain.
        }),
      );
    return task;
  }

  /**
   * Wait for all promises in the queue to resolve or for timeout to expire, whichever comes first.
   *
   * @param timeout The time, in ms, after which to resolve to `false` if the queue is still non-empty. Passing `0` (or
   * not passing anything) will make the promise wait as long as it takes for the queue to drain before resolving to
   * `true`.
   * @returns A promise which will resolve to `true` if the queue is already empty or drains before the timeout, and
   * `false` otherwise
   */
  function drain(timeout) {
    return new syncpromise.SyncPromise((resolve, reject) => {
      let counter = buffer.length;

      if (!counter) {
        return resolve(true);
      }

      // wait for `timeout` ms and then resolve to `false` (if not cancelled first)
      const capturedSetTimeout = setTimeout(() => {
        if (timeout && timeout > 0) {
          resolve(false);
        }
      }, timeout);

      // if all promises resolve in time, cancel the timer and resolve to `true`
      buffer.forEach(item => {
        void syncpromise.resolvedSyncPromise(item).then(() => {
          if (!--counter) {
            clearTimeout(capturedSetTimeout);
            resolve(true);
          }
        }, reject);
      });
    });
  }

  return {
    $: buffer,
    add,
    drain,
  };
}

exports.makePromiseBuffer = makePromiseBuffer;
//# sourceMappingURL=promisebuffer.js.map


/***/ }),

/***/ 5211:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

// Intentionally keeping the key broad, as we don't know for sure what rate limit headers get returned from backend

const DEFAULT_RETRY_AFTER = 60 * 1000; // 60 seconds

/**
 * Extracts Retry-After value from the request header or returns default value
 * @param header string representation of 'Retry-After' header
 * @param now current unix timestamp
 *
 */
function parseRetryAfterHeader(header, now = Date.now()) {
  const headerDelay = parseInt(`${header}`, 10);
  if (!isNaN(headerDelay)) {
    return headerDelay * 1000;
  }

  const headerDate = Date.parse(`${header}`);
  if (!isNaN(headerDate)) {
    return headerDate - now;
  }

  return DEFAULT_RETRY_AFTER;
}

/**
 * Gets the time that the given category is disabled until for rate limiting.
 * In case no category-specific limit is set but a general rate limit across all categories is active,
 * that time is returned.
 *
 * @return the time in ms that the category is disabled until or 0 if there's no active rate limit.
 */
function disabledUntil(limits, category) {
  return limits[category] || limits.all || 0;
}

/**
 * Checks if a category is rate limited
 */
function isRateLimited(limits, category, now = Date.now()) {
  return disabledUntil(limits, category) > now;
}

/**
 * Update ratelimits from incoming headers.
 *
 * @return the updated RateLimits object.
 */
function updateRateLimits(
  limits,
  { statusCode, headers },
  now = Date.now(),
) {
  const updatedRateLimits = {
    ...limits,
  };

  // "The name is case-insensitive."
  // https://developer.mozilla.org/en-US/docs/Web/API/Headers/get
  const rateLimitHeader = headers && headers['x-sentry-rate-limits'];
  const retryAfterHeader = headers && headers['retry-after'];

  if (rateLimitHeader) {
    /**
     * rate limit headers are of the form
     *     <header>,<header>,..
     * where each <header> is of the form
     *     <retry_after>: <categories>: <scope>: <reason_code>
     * where
     *     <retry_after> is a delay in seconds
     *     <categories> is the event type(s) (error, transaction, etc) being rate limited and is of the form
     *         <category>;<category>;...
     *     <scope> is what's being limited (org, project, or key) - ignored by SDK
     *     <reason_code> is an arbitrary string like "org_quota" - ignored by SDK
     */
    for (const limit of rateLimitHeader.trim().split(',')) {
      const [retryAfter, categories] = limit.split(':', 2);
      const headerDelay = parseInt(retryAfter, 10);
      const delay = (!isNaN(headerDelay) ? headerDelay : 60) * 1000; // 60sec default
      if (!categories) {
        updatedRateLimits.all = now + delay;
      } else {
        for (const category of categories.split(';')) {
          updatedRateLimits[category] = now + delay;
        }
      }
    }
  } else if (retryAfterHeader) {
    updatedRateLimits.all = now + parseRetryAfterHeader(retryAfterHeader, now);
  } else if (statusCode === 429) {
    updatedRateLimits.all = now + 60 * 1000;
  }

  return updatedRateLimits;
}

exports.DEFAULT_RETRY_AFTER = DEFAULT_RETRY_AFTER;
exports.disabledUntil = disabledUntil;
exports.isRateLimited = isRateLimited;
exports.parseRetryAfterHeader = parseRetryAfterHeader;
exports.updateRateLimits = updateRateLimits;
//# sourceMappingURL=ratelimit.js.map


/***/ }),

/***/ 4510:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const is = __webpack_require__(4247);
const normalize = __webpack_require__(5504);
const url = __webpack_require__(9317);

const DEFAULT_INCLUDES = {
  ip: false,
  request: true,
  transaction: true,
  user: true,
};
const DEFAULT_REQUEST_INCLUDES = ['cookies', 'data', 'headers', 'method', 'query_string', 'url'];
const DEFAULT_USER_INCLUDES = ['id', 'username', 'email'];

/**
 * Sets parameterized route as transaction name e.g.: `GET /users/:id`
 * Also adds more context data on the transaction from the request
 */
function addRequestDataToTransaction(
  transaction,
  req,
  deps,
) {
  if (!transaction) return;
  if (!transaction.metadata.source || transaction.metadata.source === 'url') {
    // Attempt to grab a parameterized route off of the request
    transaction.setName(...extractPathForTransaction(req, { path: true, method: true }));
  }
  transaction.setData('url', req.originalUrl || req.url);
  if (req.baseUrl) {
    transaction.setData('baseUrl', req.baseUrl);
  }
  transaction.setData('query', extractQueryParams(req, deps));
}

/**
 * Extracts a complete and parameterized path from the request object and uses it to construct transaction name.
 * If the parameterized transaction name cannot be extracted, we fall back to the raw URL.
 *
 * Additionally, this function determines and returns the transaction name source
 *
 * eg. GET /mountpoint/user/:id
 *
 * @param req A request object
 * @param options What to include in the transaction name (method, path, or a custom route name to be
 *                used instead of the request's route)
 *
 * @returns A tuple of the fully constructed transaction name [0] and its source [1] (can be either 'route' or 'url')
 */
function extractPathForTransaction(
  req,
  options = {},
) {
  const method = req.method && req.method.toUpperCase();

  let path = '';
  let source = 'url';

  // Check to see if there's a parameterized route we can use (as there is in Express)
  if (options.customRoute || req.route) {
    path = options.customRoute || `${req.baseUrl || ''}${req.route && req.route.path}`;
    source = 'route';
  }

  // Otherwise, just take the original URL
  else if (req.originalUrl || req.url) {
    path = url.stripUrlQueryAndFragment(req.originalUrl || req.url || '');
  }

  let name = '';
  if (options.method && method) {
    name += method;
  }
  if (options.method && options.path) {
    name += ' ';
  }
  if (options.path && path) {
    name += path;
  }

  return [name, source];
}

/** JSDoc */
function extractTransaction(req, type) {
  switch (type) {
    case 'path': {
      return extractPathForTransaction(req, { path: true })[0];
    }
    case 'handler': {
      return (req.route && req.route.stack && req.route.stack[0] && req.route.stack[0].name) || '<anonymous>';
    }
    case 'methodPath':
    default: {
      return extractPathForTransaction(req, { path: true, method: true })[0];
    }
  }
}

/** JSDoc */
function extractUserData(
  user

,
  keys,
) {
  const extractedUser = {};
  const attributes = Array.isArray(keys) ? keys : DEFAULT_USER_INCLUDES;

  attributes.forEach(key => {
    if (user && key in user) {
      extractedUser[key] = user[key];
    }
  });

  return extractedUser;
}

/**
 * Normalize data from the request object, accounting for framework differences.
 *
 * @param req The request object from which to extract data
 * @param options.include An optional array of keys to include in the normalized data. Defaults to
 * DEFAULT_REQUEST_INCLUDES if not provided.
 * @param options.deps Injected, platform-specific dependencies
 * @returns An object containing normalized request data
 */
function extractRequestData(
  req,
  options

,
) {
  const { include = DEFAULT_REQUEST_INCLUDES, deps } = options || {};
  const requestData = {};

  // headers:
  //   node, express, koa, nextjs: req.headers
  const headers = (req.headers || {})

;
  // method:
  //   node, express, koa, nextjs: req.method
  const method = req.method;
  // host:
  //   express: req.hostname in > 4 and req.host in < 4
  //   koa: req.host
  //   node, nextjs: req.headers.host
  const host = req.hostname || req.host || headers.host || '<no host>';
  // protocol:
  //   node, nextjs: <n/a>
  //   express, koa: req.protocol
  const protocol = req.protocol === 'https' || (req.socket && req.socket.encrypted) ? 'https' : 'http';
  // url (including path and query string):
  //   node, express: req.originalUrl
  //   koa, nextjs: req.url
  const originalUrl = req.originalUrl || req.url || '';
  // absolute url
  const absoluteUrl = `${protocol}://${host}${originalUrl}`;
  include.forEach(key => {
    switch (key) {
      case 'headers': {
        requestData.headers = headers;
        break;
      }
      case 'method': {
        requestData.method = method;
        break;
      }
      case 'url': {
        requestData.url = absoluteUrl;
        break;
      }
      case 'cookies': {
        // cookies:
        //   node, express, koa: req.headers.cookie
        //   vercel, sails.js, express (w/ cookie middleware), nextjs: req.cookies
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        requestData.cookies =
          // TODO (v8 / #5257): We're only sending the empty object for backwards compatibility, so the last bit can
          // come off in v8
          req.cookies || (headers.cookie && deps && deps.cookie && deps.cookie.parse(headers.cookie)) || {};
        break;
      }
      case 'query_string': {
        // query string:
        //   node: req.url (raw)
        //   express, koa, nextjs: req.query
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        requestData.query_string = extractQueryParams(req, deps);
        break;
      }
      case 'data': {
        if (method === 'GET' || method === 'HEAD') {
          break;
        }
        // body data:
        //   express, koa, nextjs: req.body
        //
        //   when using node by itself, you have to read the incoming stream(see
        //   https://nodejs.dev/learn/get-http-request-body-data-using-nodejs); if a user is doing that, we can't know
        //   where they're going to store the final result, so they'll have to capture this data themselves
        if (req.body !== undefined) {
          requestData.data = is.isString(req.body) ? req.body : JSON.stringify(normalize.normalize(req.body));
        }
        break;
      }
      default: {
        if ({}.hasOwnProperty.call(req, key)) {
          requestData[key] = (req )[key];
        }
      }
    }
  });

  return requestData;
}

/**
 * Options deciding what parts of the request to use when enhancing an event
 */

/**
 * Add data from the given request to the given event
 *
 * @param event The event to which the request data will be added
 * @param req Request object
 * @param options.include Flags to control what data is included
 * @param options.deps Injected platform-specific dependencies
 * @hidden
 */
function addRequestDataToEvent(
  event,
  req,
  options,
) {
  const include = {
    ...DEFAULT_INCLUDES,
    ...(options && options.include),
  };

  if (include.request) {
    const extractedRequestData = Array.isArray(include.request)
      ? extractRequestData(req, { include: include.request, deps: options && options.deps })
      : extractRequestData(req, { deps: options && options.deps });

    event.request = {
      ...event.request,
      ...extractedRequestData,
    };
  }

  if (include.user) {
    const extractedUser = req.user && is.isPlainObject(req.user) ? extractUserData(req.user, include.user) : {};

    if (Object.keys(extractedUser).length) {
      event.user = {
        ...event.user,
        ...extractedUser,
      };
    }
  }

  // client ip:
  //   node, nextjs: req.socket.remoteAddress
  //   express, koa: req.ip
  if (include.ip) {
    const ip = req.ip || (req.socket && req.socket.remoteAddress);
    if (ip) {
      event.user = {
        ...event.user,
        ip_address: ip,
      };
    }
  }

  if (include.transaction && !event.transaction) {
    // TODO do we even need this anymore?
    // TODO make this work for nextjs
    event.transaction = extractTransaction(req, include.transaction);
  }

  return event;
}

function extractQueryParams(
  req,
  deps,
) {
  // url (including path and query string):
  //   node, express: req.originalUrl
  //   koa, nextjs: req.url
  let originalUrl = req.originalUrl || req.url || '';

  if (!originalUrl) {
    return;
  }

  // The `URL` constructor can't handle internal URLs of the form `/some/path/here`, so stick a dummy protocol and
  // hostname on the beginning. Since the point here is just to grab the query string, it doesn't matter what we use.
  if (originalUrl.startsWith('/')) {
    originalUrl = `http://dogs.are.great${originalUrl}`;
  }

  return (
    req.query ||
    (typeof URL !== undefined && new URL(originalUrl).search.replace('?', '')) ||
    // In Node 8, `URL` isn't in the global scope, so we have to use the built-in module from Node
    (deps && deps.url && deps.url.parse(originalUrl).query) ||
    undefined
  );
}

exports.addRequestDataToEvent = addRequestDataToEvent;
exports.addRequestDataToTransaction = addRequestDataToTransaction;
exports.extractPathForTransaction = extractPathForTransaction;
exports.extractRequestData = extractRequestData;
//# sourceMappingURL=requestdata.js.map


/***/ }),

/***/ 2685:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

// Note: Ideally the `SeverityLevel` type would be derived from `validSeverityLevels`, but that would mean either
//
// a) moving `validSeverityLevels` to `@sentry/types`,
// b) moving the`SeverityLevel` type here, or
// c) importing `validSeverityLevels` from here into `@sentry/types`.
//
// Option A would make `@sentry/types` a runtime dependency of `@sentry/utils` (not good), and options B and C would
// create a circular dependency between `@sentry/types` and `@sentry/utils` (also not good). So a TODO accompanying the
// type, reminding anyone who changes it to change this list also, will have to do.

const validSeverityLevels = ['fatal', 'error', 'warning', 'log', 'info', 'debug'];

/**
 * Converts a string-based level into a member of the deprecated {@link Severity} enum.
 *
 * @deprecated `severityFromString` is deprecated. Please use `severityLevelFromString` instead.
 *
 * @param level String representation of Severity
 * @returns Severity
 */
function severityFromString(level) {
  return severityLevelFromString(level) ;
}

/**
 * Converts a string-based level into a `SeverityLevel`, normalizing it along the way.
 *
 * @param level String representation of desired `SeverityLevel`.
 * @returns The `SeverityLevel` corresponding to the given string, or 'log' if the string isn't a valid level.
 */
function severityLevelFromString(level) {
  return (level === 'warn' ? 'warning' : validSeverityLevels.includes(level) ? level : 'log') ;
}

exports.severityFromString = severityFromString;
exports.severityLevelFromString = severityLevelFromString;
exports.validSeverityLevels = validSeverityLevels;
//# sourceMappingURL=severity.js.map


/***/ }),

/***/ 4867:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const worldwide = __webpack_require__(5362);

const STACKTRACE_LIMIT = 50;

const debugIdParserCache = new Map();

/**
 * Creates a stack parser with the supplied line parsers
 *
 * StackFrames are returned in the correct order for Sentry Exception
 * frames and with Sentry SDK internal frames removed from the top and bottom
 *
 */
function createStackParser(...parsers) {
  const sortedParsers = parsers.sort((a, b) => a[0] - b[0]).map(p => p[1]);

  return (stack, skipFirst = 0) => {
    const frames = [];

    for (const parser of sortedParsers) {
      let debugIdCache = debugIdParserCache.get(parser);
      if (!debugIdCache) {
        debugIdCache = new Map();
        debugIdParserCache.set(parser, debugIdCache);
      }

      const debugIdMap = worldwide.GLOBAL_OBJ._sentryDebugIds;

      if (debugIdMap) {
        Object.keys(debugIdMap).forEach(debugIdStackTrace => {
          debugIdStackTrace.split('\n').forEach(line => {
            const frame = parser(line);
            if (frame && frame.filename) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              debugIdCache.set(frame.filename, debugIdMap[debugIdStackTrace]);
            }
          });
        });
      }
    }

    for (const line of stack.split('\n').slice(skipFirst)) {
      // Ignore lines over 1kb as they are unlikely to be stack frames.
      // Many of the regular expressions use backtracking which results in run time that increases exponentially with
      // input size. Huge strings can result in hangs/Denial of Service:
      // https://github.com/getsentry/sentry-javascript/issues/2286
      if (line.length > 1024) {
        continue;
      }

      // https://github.com/getsentry/sentry-javascript/issues/5459
      // Remove webpack (error: *) wrappers
      const cleanedLine = line.replace(/\(error: (.*)\)/, '$1');

      for (const parser of sortedParsers) {
        const frame = parser(cleanedLine);

        if (frame) {
          const debugIdCache = debugIdParserCache.get(parser);
          if (debugIdCache && frame.filename) {
            const cachedDebugId = debugIdCache.get(frame.filename);
            if (cachedDebugId) {
              frame.debug_id = cachedDebugId;
            }
          }

          frames.push(frame);
          break;
        }
      }
    }

    return stripSentryFramesAndReverse(frames);
  };
}

/**
 * Gets a stack parser implementation from Options.stackParser
 * @see Options
 *
 * If options contains an array of line parsers, it is converted into a parser
 */
function stackParserFromStackParserOptions(stackParser) {
  if (Array.isArray(stackParser)) {
    return createStackParser(...stackParser);
  }
  return stackParser;
}

/**
 * @hidden
 */
function stripSentryFramesAndReverse(stack) {
  if (!stack.length) {
    return [];
  }

  let localStack = stack;

  const firstFrameFunction = localStack[0].function || '';
  const lastFrameFunction = localStack[localStack.length - 1].function || '';

  // If stack starts with one of our API calls, remove it (starts, meaning it's the top of the stack - aka last call)
  if (firstFrameFunction.indexOf('captureMessage') !== -1 || firstFrameFunction.indexOf('captureException') !== -1) {
    localStack = localStack.slice(1);
  }

  // If stack ends with one of our internal API calls, remove it (ends, meaning it's the bottom of the stack - aka top-most call)
  if (lastFrameFunction.indexOf('sentryWrapped') !== -1) {
    localStack = localStack.slice(0, -1);
  }

  // The frame where the crash happened, should be the last entry in the array
  return localStack
    .slice(0, STACKTRACE_LIMIT)
    .map(frame => ({
      ...frame,
      filename: frame.filename || localStack[0].filename,
      function: frame.function || '?',
    }))
    .reverse();
}

const defaultFunctionName = '<anonymous>';

/**
 * Safely extract function name from itself
 */
function getFunctionName(fn) {
  try {
    if (!fn || typeof fn !== 'function') {
      return defaultFunctionName;
    }
    return fn.name || defaultFunctionName;
  } catch (e) {
    // Just accessing custom props in some Selenium environments
    // can cause a "Permission denied" exception (see raven-js#495).
    return defaultFunctionName;
  }
}

// eslint-disable-next-line complexity
function node(getModule) {
  const FILENAME_MATCH = /^\s*[-]{4,}$/;
  const FULL_MATCH = /at (?:async )?(?:(.+?)\s+\()?(?:(.+):(\d+):(\d+)?|([^)]+))\)?/;

  // eslint-disable-next-line complexity
  return (line) => {
    if (line.match(FILENAME_MATCH)) {
      return {
        filename: line,
      };
    }

    const lineMatch = line.match(FULL_MATCH);
    if (!lineMatch) {
      return undefined;
    }

    let object;
    let method;
    let functionName;
    let typeName;
    let methodName;

    if (lineMatch[1]) {
      functionName = lineMatch[1];

      let methodStart = functionName.lastIndexOf('.');
      if (functionName[methodStart - 1] === '.') {
        methodStart--;
      }

      if (methodStart > 0) {
        object = functionName.slice(0, methodStart);
        method = functionName.slice(methodStart + 1);
        const objectEnd = object.indexOf('.Module');
        if (objectEnd > 0) {
          functionName = functionName.slice(objectEnd + 1);
          object = object.slice(0, objectEnd);
        }
      }
      typeName = undefined;
    }

    if (method) {
      typeName = object;
      methodName = method;
    }

    if (method === '<anonymous>') {
      methodName = undefined;
      functionName = undefined;
    }

    if (functionName === undefined) {
      methodName = methodName || '<anonymous>';
      functionName = typeName ? `${typeName}.${methodName}` : methodName;
    }

    const filename = lineMatch[2] && lineMatch[2].startsWith('file://') ? lineMatch[2].slice(7) : lineMatch[2];
    const isNative = lineMatch[5] === 'native';
    const isInternal =
      isNative || (filename && !filename.startsWith('/') && !filename.startsWith('.') && filename.indexOf(':\\') !== 1);

    // in_app is all that's not an internal Node function or a module within node_modules
    // note that isNative appears to return true even for node core libraries
    // see https://github.com/getsentry/raven-node/issues/176
    const in_app = !isInternal && filename !== undefined && !filename.includes('node_modules/');

    return {
      filename,
      module: getModule ? getModule(filename) : undefined,
      function: functionName,
      lineno: parseInt(lineMatch[3], 10) || undefined,
      colno: parseInt(lineMatch[4], 10) || undefined,
      in_app,
    };
  };
}

/**
 * Node.js stack line parser
 *
 * This is in @sentry/utils so it can be used from the Electron SDK in the browser for when `nodeIntegration == true`.
 * This allows it to be used without referencing or importing any node specific code which causes bundlers to complain
 */
function nodeStackLineParser(getModule) {
  return [90, node(getModule)];
}

exports.createStackParser = createStackParser;
exports.getFunctionName = getFunctionName;
exports.nodeStackLineParser = nodeStackLineParser;
exports.stackParserFromStackParserOptions = stackParserFromStackParserOptions;
exports.stripSentryFramesAndReverse = stripSentryFramesAndReverse;
//# sourceMappingURL=stacktrace.js.map


/***/ }),

/***/ 255:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const is = __webpack_require__(4247);

/**
 * Truncates given string to the maximum characters count
 *
 * @param str An object that contains serializable values
 * @param max Maximum number of characters in truncated string (0 = unlimited)
 * @returns string Encoded
 */
function truncate(str, max = 0) {
  if (typeof str !== 'string' || max === 0) {
    return str;
  }
  return str.length <= max ? str : `${str.slice(0, max)}...`;
}

/**
 * This is basically just `trim_line` from
 * https://github.com/getsentry/sentry/blob/master/src/sentry/lang/javascript/processor.py#L67
 *
 * @param str An object that contains serializable values
 * @param max Maximum number of characters in truncated string
 * @returns string Encoded
 */
function snipLine(line, colno) {
  let newLine = line;
  const lineLength = newLine.length;
  if (lineLength <= 150) {
    return newLine;
  }
  if (colno > lineLength) {
    // eslint-disable-next-line no-param-reassign
    colno = lineLength;
  }

  let start = Math.max(colno - 60, 0);
  if (start < 5) {
    start = 0;
  }

  let end = Math.min(start + 140, lineLength);
  if (end > lineLength - 5) {
    end = lineLength;
  }
  if (end === lineLength) {
    start = Math.max(end - 140, 0);
  }

  newLine = newLine.slice(start, end);
  if (start > 0) {
    newLine = `'{snip} ${newLine}`;
  }
  if (end < lineLength) {
    newLine += ' {snip}';
  }

  return newLine;
}

/**
 * Join values in array
 * @param input array of values to be joined together
 * @param delimiter string to be placed in-between values
 * @returns Joined values
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeJoin(input, delimiter) {
  if (!Array.isArray(input)) {
    return '';
  }

  const output = [];
  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < input.length; i++) {
    const value = input[i];
    try {
      output.push(String(value));
    } catch (e) {
      output.push('[value cannot be serialized]');
    }
  }

  return output.join(delimiter);
}

/**
 * Checks if the given value matches a regex or string
 *
 * @param value The string to test
 * @param pattern Either a regex or a string against which `value` will be matched
 * @param requireExactStringMatch If true, `value` must match `pattern` exactly. If false, `value` will match
 * `pattern` if it contains `pattern`. Only applies to string-type patterns.
 */
function isMatchingPattern(
  value,
  pattern,
  requireExactStringMatch = false,
) {
  if (!is.isString(value)) {
    return false;
  }

  if (is.isRegExp(pattern)) {
    return pattern.test(value);
  }
  if (is.isString(pattern)) {
    return requireExactStringMatch ? value === pattern : value.includes(pattern);
  }

  return false;
}

/**
 * Test the given string against an array of strings and regexes. By default, string matching is done on a
 * substring-inclusion basis rather than a strict equality basis
 *
 * @param testString The string to test
 * @param patterns The patterns against which to test the string
 * @param requireExactStringMatch If true, `testString` must match one of the given string patterns exactly in order to
 * count. If false, `testString` will match a string pattern if it contains that pattern.
 * @returns
 */
function stringMatchesSomePattern(
  testString,
  patterns = [],
  requireExactStringMatch = false,
) {
  return patterns.some(pattern => isMatchingPattern(testString, pattern, requireExactStringMatch));
}

/**
 * Given a string, escape characters which have meaning in the regex grammar, such that the result is safe to feed to
 * `new RegExp()`.
 *
 * Based on https://github.com/sindresorhus/escape-string-regexp. Vendored to a) reduce the size by skipping the runtime
 * type-checking, and b) ensure it gets down-compiled for old versions of Node (the published package only supports Node
 * 12+).
 *
 * @param regexString The string to escape
 * @returns An version of the string with all special regex characters escaped
 */
function escapeStringForRegex(regexString) {
  // escape the hyphen separately so we can also replace it with a unicode literal hyphen, to avoid the problems
  // discussed in https://github.com/sindresorhus/escape-string-regexp/issues/20.
  return regexString.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}

exports.escapeStringForRegex = escapeStringForRegex;
exports.isMatchingPattern = isMatchingPattern;
exports.safeJoin = safeJoin;
exports.snipLine = snipLine;
exports.stringMatchesSomePattern = stringMatchesSomePattern;
exports.truncate = truncate;
//# sourceMappingURL=string.js.map


/***/ }),

/***/ 2163:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const logger = __webpack_require__(235);
const worldwide = __webpack_require__(5362);

// eslint-disable-next-line deprecation/deprecation
const WINDOW = worldwide.getGlobalObject();

/**
 * Tells whether current environment supports ErrorEvent objects
 * {@link supportsErrorEvent}.
 *
 * @returns Answer to the given question.
 */
function supportsErrorEvent() {
  try {
    new ErrorEvent('');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Tells whether current environment supports DOMError objects
 * {@link supportsDOMError}.
 *
 * @returns Answer to the given question.
 */
function supportsDOMError() {
  try {
    // Chrome: VM89:1 Uncaught TypeError: Failed to construct 'DOMError':
    // 1 argument required, but only 0 present.
    // @ts-ignore It really needs 1 argument, not 0.
    new DOMError('');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Tells whether current environment supports DOMException objects
 * {@link supportsDOMException}.
 *
 * @returns Answer to the given question.
 */
function supportsDOMException() {
  try {
    new DOMException('');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Tells whether current environment supports Fetch API
 * {@link supportsFetch}.
 *
 * @returns Answer to the given question.
 */
function supportsFetch() {
  if (!('fetch' in WINDOW)) {
    return false;
  }

  try {
    new Headers();
    new Request('http://www.example.com');
    new Response();
    return true;
  } catch (e) {
    return false;
  }
}
/**
 * isNativeFetch checks if the given function is a native implementation of fetch()
 */
// eslint-disable-next-line @typescript-eslint/ban-types
function isNativeFetch(func) {
  return func && /^function fetch\(\)\s+\{\s+\[native code\]\s+\}$/.test(func.toString());
}

/**
 * Tells whether current environment supports Fetch API natively
 * {@link supportsNativeFetch}.
 *
 * @returns true if `window.fetch` is natively implemented, false otherwise
 */
function supportsNativeFetch() {
  if (!supportsFetch()) {
    return false;
  }

  // Fast path to avoid DOM I/O
  // eslint-disable-next-line @typescript-eslint/unbound-method
  if (isNativeFetch(WINDOW.fetch)) {
    return true;
  }

  // window.fetch is implemented, but is polyfilled or already wrapped (e.g: by a chrome extension)
  // so create a "pure" iframe to see if that has native fetch
  let result = false;
  const doc = WINDOW.document;
  // eslint-disable-next-line deprecation/deprecation
  if (doc && typeof (doc.createElement ) === 'function') {
    try {
      const sandbox = doc.createElement('iframe');
      sandbox.hidden = true;
      doc.head.appendChild(sandbox);
      if (sandbox.contentWindow && sandbox.contentWindow.fetch) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        result = isNativeFetch(sandbox.contentWindow.fetch);
      }
      doc.head.removeChild(sandbox);
    } catch (err) {
      (typeof __SENTRY_DEBUG__ === 'undefined' || __SENTRY_DEBUG__) &&
        logger.logger.warn('Could not create sandbox iframe for pure fetch check, bailing to window.fetch: ', err);
    }
  }

  return result;
}

/**
 * Tells whether current environment supports ReportingObserver API
 * {@link supportsReportingObserver}.
 *
 * @returns Answer to the given question.
 */
function supportsReportingObserver() {
  return 'ReportingObserver' in WINDOW;
}

/**
 * Tells whether current environment supports Referrer Policy API
 * {@link supportsReferrerPolicy}.
 *
 * @returns Answer to the given question.
 */
function supportsReferrerPolicy() {
  // Despite all stars in the sky saying that Edge supports old draft syntax, aka 'never', 'always', 'origin' and 'default'
  // (see https://caniuse.com/#feat=referrer-policy),
  // it doesn't. And it throws an exception instead of ignoring this parameter...
  // REF: https://github.com/getsentry/raven-js/issues/1233

  if (!supportsFetch()) {
    return false;
  }

  try {
    new Request('_', {
      referrerPolicy: 'origin' ,
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Tells whether current environment supports History API
 * {@link supportsHistory}.
 *
 * @returns Answer to the given question.
 */
function supportsHistory() {
  // NOTE: in Chrome App environment, touching history.pushState, *even inside
  //       a try/catch block*, will cause Chrome to output an error to console.error
  // borrowed from: https://github.com/angular/angular.js/pull/13945/files
  /* eslint-disable @typescript-eslint/no-unsafe-member-access */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chrome = (WINDOW ).chrome;
  const isChromePackagedApp = chrome && chrome.app && chrome.app.runtime;
  /* eslint-enable @typescript-eslint/no-unsafe-member-access */
  const hasHistoryApi = 'history' in WINDOW && !!WINDOW.history.pushState && !!WINDOW.history.replaceState;

  return !isChromePackagedApp && hasHistoryApi;
}

exports.isNativeFetch = isNativeFetch;
exports.supportsDOMError = supportsDOMError;
exports.supportsDOMException = supportsDOMException;
exports.supportsErrorEvent = supportsErrorEvent;
exports.supportsFetch = supportsFetch;
exports.supportsHistory = supportsHistory;
exports.supportsNativeFetch = supportsNativeFetch;
exports.supportsReferrerPolicy = supportsReferrerPolicy;
exports.supportsReportingObserver = supportsReportingObserver;
//# sourceMappingURL=supports.js.map


/***/ }),

/***/ 5174:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const is = __webpack_require__(4247);

/* eslint-disable @typescript-eslint/explicit-function-return-type */

/** SyncPromise internal states */
var States; (function (States) {
  /** Pending */
  const PENDING = 0; States[States["PENDING"] = PENDING] = "PENDING";
  /** Resolved / OK */
  const RESOLVED = 1; States[States["RESOLVED"] = RESOLVED] = "RESOLVED";
  /** Rejected / Error */
  const REJECTED = 2; States[States["REJECTED"] = REJECTED] = "REJECTED";
})(States || (States = {}));

// Overloads so we can call resolvedSyncPromise without arguments and generic argument

/**
 * Creates a resolved sync promise.
 *
 * @param value the value to resolve the promise with
 * @returns the resolved sync promise
 */
function resolvedSyncPromise(value) {
  return new SyncPromise(resolve => {
    resolve(value);
  });
}

/**
 * Creates a rejected sync promise.
 *
 * @param value the value to reject the promise with
 * @returns the rejected sync promise
 */
function rejectedSyncPromise(reason) {
  return new SyncPromise((_, reject) => {
    reject(reason);
  });
}

/**
 * Thenable class that behaves like a Promise and follows it's interface
 * but is not async internally
 */
class SyncPromise {
   __init() {this._state = States.PENDING;}
   __init2() {this._handlers = [];}

   constructor(
    executor,
  ) {SyncPromise.prototype.__init.call(this);SyncPromise.prototype.__init2.call(this);SyncPromise.prototype.__init3.call(this);SyncPromise.prototype.__init4.call(this);SyncPromise.prototype.__init5.call(this);SyncPromise.prototype.__init6.call(this);
    try {
      executor(this._resolve, this._reject);
    } catch (e) {
      this._reject(e);
    }
  }

  /** JSDoc */
   then(
    onfulfilled,
    onrejected,
  ) {
    return new SyncPromise((resolve, reject) => {
      this._handlers.push([
        false,
        result => {
          if (!onfulfilled) {
            // TODO: ¯\_(ツ)_/¯
            // TODO: FIXME
            resolve(result );
          } else {
            try {
              resolve(onfulfilled(result));
            } catch (e) {
              reject(e);
            }
          }
        },
        reason => {
          if (!onrejected) {
            reject(reason);
          } else {
            try {
              resolve(onrejected(reason));
            } catch (e) {
              reject(e);
            }
          }
        },
      ]);
      this._executeHandlers();
    });
  }

  /** JSDoc */
   catch(
    onrejected,
  ) {
    return this.then(val => val, onrejected);
  }

  /** JSDoc */
   finally(onfinally) {
    return new SyncPromise((resolve, reject) => {
      let val;
      let isRejected;

      return this.then(
        value => {
          isRejected = false;
          val = value;
          if (onfinally) {
            onfinally();
          }
        },
        reason => {
          isRejected = true;
          val = reason;
          if (onfinally) {
            onfinally();
          }
        },
      ).then(() => {
        if (isRejected) {
          reject(val);
          return;
        }

        resolve(val );
      });
    });
  }

  /** JSDoc */
    __init3() {this._resolve = (value) => {
    this._setResult(States.RESOLVED, value);
  };}

  /** JSDoc */
    __init4() {this._reject = (reason) => {
    this._setResult(States.REJECTED, reason);
  };}

  /** JSDoc */
    __init5() {this._setResult = (state, value) => {
    if (this._state !== States.PENDING) {
      return;
    }

    if (is.isThenable(value)) {
      void (value ).then(this._resolve, this._reject);
      return;
    }

    this._state = state;
    this._value = value;

    this._executeHandlers();
  };}

  /** JSDoc */
    __init6() {this._executeHandlers = () => {
    if (this._state === States.PENDING) {
      return;
    }

    const cachedHandlers = this._handlers.slice();
    this._handlers = [];

    cachedHandlers.forEach(handler => {
      if (handler[0]) {
        return;
      }

      if (this._state === States.RESOLVED) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        handler[1](this._value );
      }

      if (this._state === States.REJECTED) {
        handler[2](this._value);
      }

      handler[0] = true;
    });
  };}
}

exports.SyncPromise = SyncPromise;
exports.rejectedSyncPromise = rejectedSyncPromise;
exports.resolvedSyncPromise = resolvedSyncPromise;
//# sourceMappingURL=syncpromise.js.map


/***/ }),

/***/ 4374:
/***/ ((module, exports, __webpack_require__) => {

/* module decorator */ module = __webpack_require__.nmd(module);
Object.defineProperty(exports, "__esModule", ({ value: true }));

const node = __webpack_require__(5197);
const worldwide = __webpack_require__(5362);

// eslint-disable-next-line deprecation/deprecation
const WINDOW = worldwide.getGlobalObject();

/**
 * An object that can return the current timestamp in seconds since the UNIX epoch.
 */

/**
 * A TimestampSource implementation for environments that do not support the Performance Web API natively.
 *
 * Note that this TimestampSource does not use a monotonic clock. A call to `nowSeconds` may return a timestamp earlier
 * than a previously returned value. We do not try to emulate a monotonic behavior in order to facilitate debugging. It
 * is more obvious to explain "why does my span have negative duration" than "why my spans have zero duration".
 */
const dateTimestampSource = {
  nowSeconds: () => Date.now() / 1000,
};

/**
 * A partial definition of the [Performance Web API]{@link https://developer.mozilla.org/en-US/docs/Web/API/Performance}
 * for accessing a high-resolution monotonic clock.
 */

/**
 * Returns a wrapper around the native Performance API browser implementation, or undefined for browsers that do not
 * support the API.
 *
 * Wrapping the native API works around differences in behavior from different browsers.
 */
function getBrowserPerformance() {
  const { performance } = WINDOW;
  if (!performance || !performance.now) {
    return undefined;
  }

  // Replace performance.timeOrigin with our own timeOrigin based on Date.now().
  //
  // This is a partial workaround for browsers reporting performance.timeOrigin such that performance.timeOrigin +
  // performance.now() gives a date arbitrarily in the past.
  //
  // Additionally, computing timeOrigin in this way fills the gap for browsers where performance.timeOrigin is
  // undefined.
  //
  // The assumption that performance.timeOrigin + performance.now() ~= Date.now() is flawed, but we depend on it to
  // interact with data coming out of performance entries.
  //
  // Note that despite recommendations against it in the spec, browsers implement the Performance API with a clock that
  // might stop when the computer is asleep (and perhaps under other circumstances). Such behavior causes
  // performance.timeOrigin + performance.now() to have an arbitrary skew over Date.now(). In laptop computers, we have
  // observed skews that can be as long as days, weeks or months.
  //
  // See https://github.com/getsentry/sentry-javascript/issues/2590.
  //
  // BUG: despite our best intentions, this workaround has its limitations. It mostly addresses timings of pageload
  // transactions, but ignores the skew built up over time that can aversely affect timestamps of navigation
  // transactions of long-lived web pages.
  const timeOrigin = Date.now() - performance.now();

  return {
    now: () => performance.now(),
    timeOrigin,
  };
}

/**
 * Returns the native Performance API implementation from Node.js. Returns undefined in old Node.js versions that don't
 * implement the API.
 */
function getNodePerformance() {
  try {
    const perfHooks = node.dynamicRequire(module, 'perf_hooks') ;
    return perfHooks.performance;
  } catch (_) {
    return undefined;
  }
}

/**
 * The Performance API implementation for the current platform, if available.
 */
const platformPerformance = node.isNodeEnv() ? getNodePerformance() : getBrowserPerformance();

const timestampSource =
  platformPerformance === undefined
    ? dateTimestampSource
    : {
        nowSeconds: () => (platformPerformance.timeOrigin + platformPerformance.now()) / 1000,
      };

/**
 * Returns a timestamp in seconds since the UNIX epoch using the Date API.
 */
const dateTimestampInSeconds = dateTimestampSource.nowSeconds.bind(dateTimestampSource);

/**
 * Returns a timestamp in seconds since the UNIX epoch using either the Performance or Date APIs, depending on the
 * availability of the Performance API.
 *
 * See `usingPerformanceAPI` to test whether the Performance API is used.
 *
 * BUG: Note that because of how browsers implement the Performance API, the clock might stop when the computer is
 * asleep. This creates a skew between `dateTimestampInSeconds` and `timestampInSeconds`. The
 * skew can grow to arbitrary amounts like days, weeks or months.
 * See https://github.com/getsentry/sentry-javascript/issues/2590.
 */
const timestampInSeconds = timestampSource.nowSeconds.bind(timestampSource);

// Re-exported with an old name for backwards-compatibility.
const timestampWithMs = timestampInSeconds;

/**
 * A boolean that is true when timestampInSeconds uses the Performance API to produce monotonic timestamps.
 */
const usingPerformanceAPI = platformPerformance !== undefined;

/**
 * Internal helper to store what is the source of browserPerformanceTimeOrigin below. For debugging only.
 */
exports._browserPerformanceTimeOriginMode = void 0;

/**
 * The number of milliseconds since the UNIX epoch. This value is only usable in a browser, and only when the
 * performance API is available.
 */
const browserPerformanceTimeOrigin = (() => {
  // Unfortunately browsers may report an inaccurate time origin data, through either performance.timeOrigin or
  // performance.timing.navigationStart, which results in poor results in performance data. We only treat time origin
  // data as reliable if they are within a reasonable threshold of the current time.

  const { performance } = WINDOW;
  if (!performance || !performance.now) {
    exports._browserPerformanceTimeOriginMode = 'none';
    return undefined;
  }

  const threshold = 3600 * 1000;
  const performanceNow = performance.now();
  const dateNow = Date.now();

  // if timeOrigin isn't available set delta to threshold so it isn't used
  const timeOriginDelta = performance.timeOrigin
    ? Math.abs(performance.timeOrigin + performanceNow - dateNow)
    : threshold;
  const timeOriginIsReliable = timeOriginDelta < threshold;

  // While performance.timing.navigationStart is deprecated in favor of performance.timeOrigin, performance.timeOrigin
  // is not as widely supported. Namely, performance.timeOrigin is undefined in Safari as of writing.
  // Also as of writing, performance.timing is not available in Web Workers in mainstream browsers, so it is not always
  // a valid fallback. In the absence of an initial time provided by the browser, fallback to the current time from the
  // Date API.
  // eslint-disable-next-line deprecation/deprecation
  const navigationStart = performance.timing && performance.timing.navigationStart;
  const hasNavigationStart = typeof navigationStart === 'number';
  // if navigationStart isn't available set delta to threshold so it isn't used
  const navigationStartDelta = hasNavigationStart ? Math.abs(navigationStart + performanceNow - dateNow) : threshold;
  const navigationStartIsReliable = navigationStartDelta < threshold;

  if (timeOriginIsReliable || navigationStartIsReliable) {
    // Use the more reliable time origin
    if (timeOriginDelta <= navigationStartDelta) {
      exports._browserPerformanceTimeOriginMode = 'timeOrigin';
      return performance.timeOrigin;
    } else {
      exports._browserPerformanceTimeOriginMode = 'navigationStart';
      return navigationStart;
    }
  }

  // Either both timeOrigin and navigationStart are skewed or neither is available, fallback to Date.
  exports._browserPerformanceTimeOriginMode = 'dateNow';
  return dateNow;
})();

exports.browserPerformanceTimeOrigin = browserPerformanceTimeOrigin;
exports.dateTimestampInSeconds = dateTimestampInSeconds;
exports.timestampInSeconds = timestampInSeconds;
exports.timestampWithMs = timestampWithMs;
exports.usingPerformanceAPI = usingPerformanceAPI;
//# sourceMappingURL=time.js.map


/***/ }),

/***/ 8211:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

const TRACEPARENT_REGEXP = new RegExp(
  '^[ \\t]*' + // whitespace
    '([0-9a-f]{32})?' + // trace_id
    '-?([0-9a-f]{16})?' + // span_id
    '-?([01])?' + // sampled
    '[ \\t]*$', // whitespace
);

/**
 * Extract transaction context data from a `sentry-trace` header.
 *
 * @param traceparent Traceparent string
 *
 * @returns Object containing data from the header, or undefined if traceparent string is malformed
 */
function extractTraceparentData(traceparent) {
  const matches = traceparent.match(TRACEPARENT_REGEXP);

  if (!traceparent || !matches) {
    // empty string or no matches is invalid traceparent data
    return undefined;
  }

  let parentSampled;
  if (matches[3] === '1') {
    parentSampled = true;
  } else if (matches[3] === '0') {
    parentSampled = false;
  }

  return {
    traceId: matches[1],
    parentSampled,
    parentSpanId: matches[2],
  };
}

exports.TRACEPARENT_REGEXP = TRACEPARENT_REGEXP;
exports.extractTraceparentData = extractTraceparentData;
//# sourceMappingURL=tracing.js.map


/***/ }),

/***/ 9317:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Parses string form of URL into an object
 * // borrowed from https://tools.ietf.org/html/rfc3986#appendix-B
 * // intentionally using regex and not <a/> href parsing trick because React Native and other
 * // environments where DOM might not be available
 * @returns parsed URL object
 */
function parseUrl(url)

 {
  if (!url) {
    return {};
  }

  const match = url.match(/^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/);

  if (!match) {
    return {};
  }

  // coerce to undefined values to empty string so we don't get 'undefined'
  const query = match[6] || '';
  const fragment = match[8] || '';
  return {
    host: match[4],
    path: match[5],
    protocol: match[2],
    relative: match[5] + query + fragment, // everything minus origin
  };
}

/**
 * Strip the query string and fragment off of a given URL or path (if present)
 *
 * @param urlPath Full URL or path, including possible query string and/or fragment
 * @returns URL or path without query string or fragment
 */
function stripUrlQueryAndFragment(urlPath) {
  // eslint-disable-next-line no-useless-escape
  return urlPath.split(/[\?#]/, 1)[0];
}

/**
 * Returns number of URL segments of a passed string URL.
 */
function getNumberOfUrlSegments(url) {
  // split at '/' or at '\/' to split regex urls correctly
  return url.split(/\\?\//).filter(s => s.length > 0 && s !== ',').length;
}

exports.getNumberOfUrlSegments = getNumberOfUrlSegments;
exports.parseUrl = parseUrl;
exports.stripUrlQueryAndFragment = stripUrlQueryAndFragment;
//# sourceMappingURL=url.js.map


/***/ }),

/***/ 5362:
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));

/** Internal global with common properties and Sentry extensions  */

// The code below for 'isGlobalObj' and 'GLOBAL_OBJ' was copied from core-js before modification
// https://github.com/zloirock/core-js/blob/1b944df55282cdc99c90db5f49eb0b6eda2cc0a3/packages/core-js/internals/global.js
// core-js has the following licence:
//
// Copyright (c) 2014-2022 Denis Pushkarev
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/** Returns 'obj' if it's the global object, otherwise returns undefined */
function isGlobalObj(obj) {
  return obj && obj.Math == Math ? obj : undefined;
}

/** Get's the global object for the current JavaScript runtime */
const GLOBAL_OBJ =
  (typeof globalThis == 'object' && isGlobalObj(globalThis)) ||
  // eslint-disable-next-line no-restricted-globals
  (typeof window == 'object' && isGlobalObj(window)) ||
  (typeof self == 'object' && isGlobalObj(self)) ||
  (typeof global == 'object' && isGlobalObj(global)) ||
  (function () {
    return this;
  })() ||
  {};

/**
 * @deprecated Use GLOBAL_OBJ instead or WINDOW from @sentry/browser. This will be removed in v8
 */
function getGlobalObject() {
  return GLOBAL_OBJ ;
}

/**
 * Returns a global singleton contained in the global `__SENTRY__` object.
 *
 * If the singleton doesn't already exist in `__SENTRY__`, it will be created using the given factory
 * function and added to the `__SENTRY__` object.
 *
 * @param name name of the global singleton on __SENTRY__
 * @param creator creator Factory function to create the singleton if it doesn't already exist on `__SENTRY__`
 * @param obj (Optional) The global object on which to look for `__SENTRY__`, if not `GLOBAL_OBJ`'s return value
 * @returns the singleton
 */
function getGlobalSingleton(name, creator, obj) {
  const gbl = (obj || GLOBAL_OBJ) ;
  const __SENTRY__ = (gbl.__SENTRY__ = gbl.__SENTRY__ || {});
  const singleton = __SENTRY__[name] || (__SENTRY__[name] = creator());
  return singleton;
}

exports.GLOBAL_OBJ = GLOBAL_OBJ;
exports.getGlobalObject = getGlobalObject;
exports.getGlobalSingleton = getGlobalSingleton;
//# sourceMappingURL=worldwide.js.map


/***/ }),

/***/ 8249:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const events_1 = __webpack_require__(2361);
const debug_1 = __importDefault(__webpack_require__(7564));
const promisify_1 = __importDefault(__webpack_require__(9172));
const debug = debug_1.default('agent-base');
function isAgent(v) {
    return Boolean(v) && typeof v.addRequest === 'function';
}
function isSecureEndpoint() {
    const { stack } = new Error();
    if (typeof stack !== 'string')
        return false;
    return stack.split('\n').some(l => l.indexOf('(https.js:') !== -1 || l.indexOf('node:https:') !== -1);
}
function createAgent(callback, opts) {
    return new createAgent.Agent(callback, opts);
}
(function (createAgent) {
    /**
     * Base `http.Agent` implementation.
     * No pooling/keep-alive is implemented by default.
     *
     * @param {Function} callback
     * @api public
     */
    class Agent extends events_1.EventEmitter {
        constructor(callback, _opts) {
            super();
            let opts = _opts;
            if (typeof callback === 'function') {
                this.callback = callback;
            }
            else if (callback) {
                opts = callback;
            }
            // Timeout for the socket to be returned from the callback
            this.timeout = null;
            if (opts && typeof opts.timeout === 'number') {
                this.timeout = opts.timeout;
            }
            // These aren't actually used by `agent-base`, but are required
            // for the TypeScript definition files in `@types/node` :/
            this.maxFreeSockets = 1;
            this.maxSockets = 1;
            this.maxTotalSockets = Infinity;
            this.sockets = {};
            this.freeSockets = {};
            this.requests = {};
            this.options = {};
        }
        get defaultPort() {
            if (typeof this.explicitDefaultPort === 'number') {
                return this.explicitDefaultPort;
            }
            return isSecureEndpoint() ? 443 : 80;
        }
        set defaultPort(v) {
            this.explicitDefaultPort = v;
        }
        get protocol() {
            if (typeof this.explicitProtocol === 'string') {
                return this.explicitProtocol;
            }
            return isSecureEndpoint() ? 'https:' : 'http:';
        }
        set protocol(v) {
            this.explicitProtocol = v;
        }
        callback(req, opts, fn) {
            throw new Error('"agent-base" has no default implementation, you must subclass and override `callback()`');
        }
        /**
         * Called by node-core's "_http_client.js" module when creating
         * a new HTTP request with this Agent instance.
         *
         * @api public
         */
        addRequest(req, _opts) {
            const opts = Object.assign({}, _opts);
            if (typeof opts.secureEndpoint !== 'boolean') {
                opts.secureEndpoint = isSecureEndpoint();
            }
            if (opts.host == null) {
                opts.host = 'localhost';
            }
            if (opts.port == null) {
                opts.port = opts.secureEndpoint ? 443 : 80;
            }
            if (opts.protocol == null) {
                opts.protocol = opts.secureEndpoint ? 'https:' : 'http:';
            }
            if (opts.host && opts.path) {
                // If both a `host` and `path` are specified then it's most
                // likely the result of a `url.parse()` call... we need to
                // remove the `path` portion so that `net.connect()` doesn't
                // attempt to open that as a unix socket file.
                delete opts.path;
            }
            delete opts.agent;
            delete opts.hostname;
            delete opts._defaultAgent;
            delete opts.defaultPort;
            delete opts.createConnection;
            // Hint to use "Connection: close"
            // XXX: non-documented `http` module API :(
            req._last = true;
            req.shouldKeepAlive = false;
            let timedOut = false;
            let timeoutId = null;
            const timeoutMs = opts.timeout || this.timeout;
            const onerror = (err) => {
                if (req._hadError)
                    return;
                req.emit('error', err);
                // For Safety. Some additional errors might fire later on
                // and we need to make sure we don't double-fire the error event.
                req._hadError = true;
            };
            const ontimeout = () => {
                timeoutId = null;
                timedOut = true;
                const err = new Error(`A "socket" was not created for HTTP request before ${timeoutMs}ms`);
                err.code = 'ETIMEOUT';
                onerror(err);
            };
            const callbackError = (err) => {
                if (timedOut)
                    return;
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                onerror(err);
            };
            const onsocket = (socket) => {
                if (timedOut)
                    return;
                if (timeoutId != null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (isAgent(socket)) {
                    // `socket` is actually an `http.Agent` instance, so
                    // relinquish responsibility for this `req` to the Agent
                    // from here on
                    debug('Callback returned another Agent instance %o', socket.constructor.name);
                    socket.addRequest(req, opts);
                    return;
                }
                if (socket) {
                    socket.once('free', () => {
                        this.freeSocket(socket, opts);
                    });
                    req.onSocket(socket);
                    return;
                }
                const err = new Error(`no Duplex stream was returned to agent-base for \`${req.method} ${req.path}\``);
                onerror(err);
            };
            if (typeof this.callback !== 'function') {
                onerror(new Error('`callback` is not defined'));
                return;
            }
            if (!this.promisifiedCallback) {
                if (this.callback.length >= 3) {
                    debug('Converting legacy callback function to promise');
                    this.promisifiedCallback = promisify_1.default(this.callback);
                }
                else {
                    this.promisifiedCallback = this.callback;
                }
            }
            if (typeof timeoutMs === 'number' && timeoutMs > 0) {
                timeoutId = setTimeout(ontimeout, timeoutMs);
            }
            if ('port' in opts && typeof opts.port !== 'number') {
                opts.port = Number(opts.port);
            }
            try {
                debug('Resolving socket for %o request: %o', opts.protocol, `${req.method} ${req.path}`);
                Promise.resolve(this.promisifiedCallback(req, opts)).then(onsocket, callbackError);
            }
            catch (err) {
                Promise.reject(err).catch(callbackError);
            }
        }
        freeSocket(socket, opts) {
            debug('Freeing socket %o %o', socket.constructor.name, opts);
            socket.destroy();
        }
        destroy() {
            debug('Destroying agent %o', this.constructor.name);
        }
    }
    createAgent.Agent = Agent;
    // So that `instanceof` works correctly
    createAgent.prototype = createAgent.Agent.prototype;
})(createAgent || (createAgent = {}));
module.exports = createAgent;
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 9172:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
function promisify(fn) {
    return function (req, opts) {
        return new Promise((resolve, reject) => {
            fn.call(this, req, opts, (err, rtn) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rtn);
                }
            });
        });
    };
}
exports["default"] = promisify;
//# sourceMappingURL=promisify.js.map

/***/ }),

/***/ 1373:
/***/ ((__unused_webpack_module, exports) => {

"use strict";
/*!
 * cookie
 * Copyright(c) 2012-2014 Roman Shtylman
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */



/**
 * Module exports.
 * @public
 */

exports.parse = parse;
exports.serialize = serialize;

/**
 * Module variables.
 * @private
 */

var decode = decodeURIComponent;
var encode = encodeURIComponent;

/**
 * RegExp to match field-content in RFC 7230 sec 3.2
 *
 * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 * field-vchar   = VCHAR / obs-text
 * obs-text      = %x80-FF
 */

var fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

/**
 * Parse a cookie header.
 *
 * Parse the given cookie header string into an object
 * The object has the various cookies as keys(names) => values
 *
 * @param {string} str
 * @param {object} [options]
 * @return {object}
 * @public
 */

function parse(str, options) {
  if (typeof str !== 'string') {
    throw new TypeError('argument str must be a string');
  }

  var obj = {}
  var opt = options || {};
  var pairs = str.split(';')
  var dec = opt.decode || decode;

  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i];
    var index = pair.indexOf('=')

    // skip things that don't look like key=value
    if (index < 0) {
      continue;
    }

    var key = pair.substring(0, index).trim()

    // only assign once
    if (undefined == obj[key]) {
      var val = pair.substring(index + 1, pair.length).trim()

      // quoted values
      if (val[0] === '"') {
        val = val.slice(1, -1)
      }

      obj[key] = tryDecode(val, dec);
    }
  }

  return obj;
}

/**
 * Serialize data into a cookie header.
 *
 * Serialize the a name value pair into a cookie string suitable for
 * http headers. An optional options object specified cookie parameters.
 *
 * serialize('foo', 'bar', { httpOnly: true })
 *   => "foo=bar; httpOnly"
 *
 * @param {string} name
 * @param {string} val
 * @param {object} [options]
 * @return {string}
 * @public
 */

function serialize(name, val, options) {
  var opt = options || {};
  var enc = opt.encode || encode;

  if (typeof enc !== 'function') {
    throw new TypeError('option encode is invalid');
  }

  if (!fieldContentRegExp.test(name)) {
    throw new TypeError('argument name is invalid');
  }

  var value = enc(val);

  if (value && !fieldContentRegExp.test(value)) {
    throw new TypeError('argument val is invalid');
  }

  var str = name + '=' + value;

  if (null != opt.maxAge) {
    var maxAge = opt.maxAge - 0;

    if (isNaN(maxAge) || !isFinite(maxAge)) {
      throw new TypeError('option maxAge is invalid')
    }

    str += '; Max-Age=' + Math.floor(maxAge);
  }

  if (opt.domain) {
    if (!fieldContentRegExp.test(opt.domain)) {
      throw new TypeError('option domain is invalid');
    }

    str += '; Domain=' + opt.domain;
  }

  if (opt.path) {
    if (!fieldContentRegExp.test(opt.path)) {
      throw new TypeError('option path is invalid');
    }

    str += '; Path=' + opt.path;
  }

  if (opt.expires) {
    if (typeof opt.expires.toUTCString !== 'function') {
      throw new TypeError('option expires is invalid');
    }

    str += '; Expires=' + opt.expires.toUTCString();
  }

  if (opt.httpOnly) {
    str += '; HttpOnly';
  }

  if (opt.secure) {
    str += '; Secure';
  }

  if (opt.sameSite) {
    var sameSite = typeof opt.sameSite === 'string'
      ? opt.sameSite.toLowerCase() : opt.sameSite;

    switch (sameSite) {
      case true:
        str += '; SameSite=Strict';
        break;
      case 'lax':
        str += '; SameSite=Lax';
        break;
      case 'strict':
        str += '; SameSite=Strict';
        break;
      case 'none':
        str += '; SameSite=None';
        break;
      default:
        throw new TypeError('option sameSite is invalid');
    }
  }

  return str;
}

/**
 * Try decoding a string using a decoding function.
 *
 * @param {string} str
 * @param {function} decode
 * @private
 */

function tryDecode(str, decode) {
  try {
    return decode(str);
  } catch (e) {
    return str;
  }
}


/***/ }),

/***/ 2610:
/***/ ((module, exports, __webpack_require__) => {

/* eslint-env browser */

/**
 * This is the web browser implementation of `debug()`.
 */

exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = localstorage();
exports.destroy = (() => {
	let warned = false;

	return () => {
		if (!warned) {
			warned = true;
			console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
		}
	};
})();

/**
 * Colors.
 */

exports.colors = [
	'#0000CC',
	'#0000FF',
	'#0033CC',
	'#0033FF',
	'#0066CC',
	'#0066FF',
	'#0099CC',
	'#0099FF',
	'#00CC00',
	'#00CC33',
	'#00CC66',
	'#00CC99',
	'#00CCCC',
	'#00CCFF',
	'#3300CC',
	'#3300FF',
	'#3333CC',
	'#3333FF',
	'#3366CC',
	'#3366FF',
	'#3399CC',
	'#3399FF',
	'#33CC00',
	'#33CC33',
	'#33CC66',
	'#33CC99',
	'#33CCCC',
	'#33CCFF',
	'#6600CC',
	'#6600FF',
	'#6633CC',
	'#6633FF',
	'#66CC00',
	'#66CC33',
	'#9900CC',
	'#9900FF',
	'#9933CC',
	'#9933FF',
	'#99CC00',
	'#99CC33',
	'#CC0000',
	'#CC0033',
	'#CC0066',
	'#CC0099',
	'#CC00CC',
	'#CC00FF',
	'#CC3300',
	'#CC3333',
	'#CC3366',
	'#CC3399',
	'#CC33CC',
	'#CC33FF',
	'#CC6600',
	'#CC6633',
	'#CC9900',
	'#CC9933',
	'#CCCC00',
	'#CCCC33',
	'#FF0000',
	'#FF0033',
	'#FF0066',
	'#FF0099',
	'#FF00CC',
	'#FF00FF',
	'#FF3300',
	'#FF3333',
	'#FF3366',
	'#FF3399',
	'#FF33CC',
	'#FF33FF',
	'#FF6600',
	'#FF6633',
	'#FF9900',
	'#FF9933',
	'#FFCC00',
	'#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

// eslint-disable-next-line complexity
function useColors() {
	// NB: In an Electron preload script, document will be defined but not fully
	// initialized. Since we know we're in Chrome, we'll just detect this case
	// explicitly
	if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
		return true;
	}

	// Internet Explorer and Edge do not support colors.
	if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
		return false;
	}

	// Is webkit? http://stackoverflow.com/a/16459606/376773
	// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
	return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
		// Is firebug? http://stackoverflow.com/a/398120/376773
		(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
		// Is firefox >= v31?
		// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
		// Double check webkit in userAgent just in case we are in a worker
		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
	args[0] = (this.useColors ? '%c' : '') +
		this.namespace +
		(this.useColors ? ' %c' : ' ') +
		args[0] +
		(this.useColors ? '%c ' : ' ') +
		'+' + module.exports.humanize(this.diff);

	if (!this.useColors) {
		return;
	}

	const c = 'color: ' + this.color;
	args.splice(1, 0, c, 'color: inherit');

	// The final "%c" is somewhat tricky, because there could be other
	// arguments passed either before or after the %c, so we need to
	// figure out the correct index to insert the CSS into
	let index = 0;
	let lastC = 0;
	args[0].replace(/%[a-zA-Z%]/g, match => {
		if (match === '%%') {
			return;
		}
		index++;
		if (match === '%c') {
			// We only are interested in the *last* %c
			// (the user may have provided their own)
			lastC = index;
		}
	});

	args.splice(lastC, 0, c);
}

/**
 * Invokes `console.debug()` when available.
 * No-op when `console.debug` is not a "function".
 * If `console.debug` is not available, falls back
 * to `console.log`.
 *
 * @api public
 */
exports.log = console.debug || console.log || (() => {});

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
	try {
		if (namespaces) {
			exports.storage.setItem('debug', namespaces);
		} else {
			exports.storage.removeItem('debug');
		}
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
function load() {
	let r;
	try {
		r = exports.storage.getItem('debug');
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}

	// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
	if (!r && typeof process !== 'undefined' && 'env' in process) {
		r = process.env.DEBUG;
	}

	return r;
}

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
	try {
		// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
		// The Browser also has localStorage in the global context.
		return localStorage;
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

module.exports = __webpack_require__(554)(exports);

const {formatters} = module.exports;

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

formatters.j = function (v) {
	try {
		return JSON.stringify(v);
	} catch (error) {
		return '[UnexpectedJSONParseError]: ' + error.message;
	}
};


/***/ }),

/***/ 554:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */

function setup(env) {
	createDebug.debug = createDebug;
	createDebug.default = createDebug;
	createDebug.coerce = coerce;
	createDebug.disable = disable;
	createDebug.enable = enable;
	createDebug.enabled = enabled;
	createDebug.humanize = __webpack_require__(6338);
	createDebug.destroy = destroy;

	Object.keys(env).forEach(key => {
		createDebug[key] = env[key];
	});

	/**
	* The currently active debug mode names, and names to skip.
	*/

	createDebug.names = [];
	createDebug.skips = [];

	/**
	* Map of special "%n" handling functions, for the debug "format" argument.
	*
	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	*/
	createDebug.formatters = {};

	/**
	* Selects a color for a debug namespace
	* @param {String} namespace The namespace string for the debug instance to be colored
	* @return {Number|String} An ANSI color code for the given namespace
	* @api private
	*/
	function selectColor(namespace) {
		let hash = 0;

		for (let i = 0; i < namespace.length; i++) {
			hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
			hash |= 0; // Convert to 32bit integer
		}

		return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
	}
	createDebug.selectColor = selectColor;

	/**
	* Create a debugger with the given `namespace`.
	*
	* @param {String} namespace
	* @return {Function}
	* @api public
	*/
	function createDebug(namespace) {
		let prevTime;
		let enableOverride = null;
		let namespacesCache;
		let enabledCache;

		function debug(...args) {
			// Disabled?
			if (!debug.enabled) {
				return;
			}

			const self = debug;

			// Set `diff` timestamp
			const curr = Number(new Date());
			const ms = curr - (prevTime || curr);
			self.diff = ms;
			self.prev = prevTime;
			self.curr = curr;
			prevTime = curr;

			args[0] = createDebug.coerce(args[0]);

			if (typeof args[0] !== 'string') {
				// Anything else let's inspect with %O
				args.unshift('%O');
			}

			// Apply any `formatters` transformations
			let index = 0;
			args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
				// If we encounter an escaped % then don't increase the array index
				if (match === '%%') {
					return '%';
				}
				index++;
				const formatter = createDebug.formatters[format];
				if (typeof formatter === 'function') {
					const val = args[index];
					match = formatter.call(self, val);

					// Now we need to remove `args[index]` since it's inlined in the `format`
					args.splice(index, 1);
					index--;
				}
				return match;
			});

			// Apply env-specific formatting (colors, etc.)
			createDebug.formatArgs.call(self, args);

			const logFn = self.log || createDebug.log;
			logFn.apply(self, args);
		}

		debug.namespace = namespace;
		debug.useColors = createDebug.useColors();
		debug.color = createDebug.selectColor(namespace);
		debug.extend = extend;
		debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.

		Object.defineProperty(debug, 'enabled', {
			enumerable: true,
			configurable: false,
			get: () => {
				if (enableOverride !== null) {
					return enableOverride;
				}
				if (namespacesCache !== createDebug.namespaces) {
					namespacesCache = createDebug.namespaces;
					enabledCache = createDebug.enabled(namespace);
				}

				return enabledCache;
			},
			set: v => {
				enableOverride = v;
			}
		});

		// Env-specific initialization logic for debug instances
		if (typeof createDebug.init === 'function') {
			createDebug.init(debug);
		}

		return debug;
	}

	function extend(namespace, delimiter) {
		const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
		newDebug.log = this.log;
		return newDebug;
	}

	/**
	* Enables a debug mode by namespaces. This can include modes
	* separated by a colon and wildcards.
	*
	* @param {String} namespaces
	* @api public
	*/
	function enable(namespaces) {
		createDebug.save(namespaces);
		createDebug.namespaces = namespaces;

		createDebug.names = [];
		createDebug.skips = [];

		let i;
		const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
		const len = split.length;

		for (i = 0; i < len; i++) {
			if (!split[i]) {
				// ignore empty strings
				continue;
			}

			namespaces = split[i].replace(/\*/g, '.*?');

			if (namespaces[0] === '-') {
				createDebug.skips.push(new RegExp('^' + namespaces.slice(1) + '$'));
			} else {
				createDebug.names.push(new RegExp('^' + namespaces + '$'));
			}
		}
	}

	/**
	* Disable debug output.
	*
	* @return {String} namespaces
	* @api public
	*/
	function disable() {
		const namespaces = [
			...createDebug.names.map(toNamespace),
			...createDebug.skips.map(toNamespace).map(namespace => '-' + namespace)
		].join(',');
		createDebug.enable('');
		return namespaces;
	}

	/**
	* Returns true if the given mode name is enabled, false otherwise.
	*
	* @param {String} name
	* @return {Boolean}
	* @api public
	*/
	function enabled(name) {
		if (name[name.length - 1] === '*') {
			return true;
		}

		let i;
		let len;

		for (i = 0, len = createDebug.skips.length; i < len; i++) {
			if (createDebug.skips[i].test(name)) {
				return false;
			}
		}

		for (i = 0, len = createDebug.names.length; i < len; i++) {
			if (createDebug.names[i].test(name)) {
				return true;
			}
		}

		return false;
	}

	/**
	* Convert regexp to namespace
	*
	* @param {RegExp} regxep
	* @return {String} namespace
	* @api private
	*/
	function toNamespace(regexp) {
		return regexp.toString()
			.substring(2, regexp.toString().length - 2)
			.replace(/\.\*\?$/, '*');
	}

	/**
	* Coerce `val`.
	*
	* @param {Mixed} val
	* @return {Mixed}
	* @api private
	*/
	function coerce(val) {
		if (val instanceof Error) {
			return val.stack || val.message;
		}
		return val;
	}

	/**
	* XXX DO NOT USE. This is a temporary stub function.
	* XXX It WILL be removed in the next major release.
	*/
	function destroy() {
		console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
	}

	createDebug.enable(createDebug.load());

	return createDebug;
}

module.exports = setup;


/***/ }),

/***/ 7564:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/**
 * Detect Electron renderer / nwjs process, which is node, but we should
 * treat as a browser.
 */

if (typeof process === 'undefined' || process.type === 'renderer' || false === true || process.__nwjs) {
	module.exports = __webpack_require__(2610);
} else {
	module.exports = __webpack_require__(6704);
}


/***/ }),

/***/ 6704:
/***/ ((module, exports, __webpack_require__) => {

/**
 * Module dependencies.
 */

const tty = __webpack_require__(6224);
const util = __webpack_require__(3837);

/**
 * This is the Node.js implementation of `debug()`.
 */

exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.destroy = util.deprecate(
	() => {},
	'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.'
);

/**
 * Colors.
 */

exports.colors = [6, 2, 3, 4, 5, 1];

try {
	// Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
	// eslint-disable-next-line import/no-extraneous-dependencies
	const supportsColor = __webpack_require__(2195);

	if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
		exports.colors = [
			20,
			21,
			26,
			27,
			32,
			33,
			38,
			39,
			40,
			41,
			42,
			43,
			44,
			45,
			56,
			57,
			62,
			63,
			68,
			69,
			74,
			75,
			76,
			77,
			78,
			79,
			80,
			81,
			92,
			93,
			98,
			99,
			112,
			113,
			128,
			129,
			134,
			135,
			148,
			149,
			160,
			161,
			162,
			163,
			164,
			165,
			166,
			167,
			168,
			169,
			170,
			171,
			172,
			173,
			178,
			179,
			184,
			185,
			196,
			197,
			198,
			199,
			200,
			201,
			202,
			203,
			204,
			205,
			206,
			207,
			208,
			209,
			214,
			215,
			220,
			221
		];
	}
} catch (error) {
	// Swallow - we only care if `supports-color` is available; it doesn't have to be.
}

/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */

exports.inspectOpts = Object.keys(process.env).filter(key => {
	return /^debug_/i.test(key);
}).reduce((obj, key) => {
	// Camel-case
	const prop = key
		.substring(6)
		.toLowerCase()
		.replace(/_([a-z])/g, (_, k) => {
			return k.toUpperCase();
		});

	// Coerce string value into JS value
	let val = process.env[key];
	if (/^(yes|on|true|enabled)$/i.test(val)) {
		val = true;
	} else if (/^(no|off|false|disabled)$/i.test(val)) {
		val = false;
	} else if (val === 'null') {
		val = null;
	} else {
		val = Number(val);
	}

	obj[prop] = val;
	return obj;
}, {});

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */

function useColors() {
	return 'colors' in exports.inspectOpts ?
		Boolean(exports.inspectOpts.colors) :
		tty.isatty(process.stderr.fd);
}

/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */

function formatArgs(args) {
	const {namespace: name, useColors} = this;

	if (useColors) {
		const c = this.color;
		const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c);
		const prefix = `  ${colorCode};1m${name} \u001B[0m`;

		args[0] = prefix + args[0].split('\n').join('\n' + prefix);
		args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m');
	} else {
		args[0] = getDate() + name + ' ' + args[0];
	}
}

function getDate() {
	if (exports.inspectOpts.hideDate) {
		return '';
	}
	return new Date().toISOString() + ' ';
}

/**
 * Invokes `util.format()` with the specified arguments and writes to stderr.
 */

function log(...args) {
	return process.stderr.write(util.format(...args) + '\n');
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
	if (namespaces) {
		process.env.DEBUG = namespaces;
	} else {
		// If you set a process.env field to null or undefined, it gets cast to the
		// string 'null' or 'undefined'. Just delete instead.
		delete process.env.DEBUG;
	}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
	return process.env.DEBUG;
}

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */

function init(debug) {
	debug.inspectOpts = {};

	const keys = Object.keys(exports.inspectOpts);
	for (let i = 0; i < keys.length; i++) {
		debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
	}
}

module.exports = __webpack_require__(554)(exports);

const {formatters} = module.exports;

/**
 * Map %o to `util.inspect()`, all on a single line.
 */

formatters.o = function (v) {
	this.inspectOpts.colors = this.useColors;
	return util.inspect(v, this.inspectOpts)
		.split('\n')
		.map(str => str.trim())
		.join(' ');
};

/**
 * Map %O to `util.inspect()`, allowing multiple lines if needed.
 */

formatters.O = function (v) {
	this.inspectOpts.colors = this.useColors;
	return util.inspect(v, this.inspectOpts);
};


/***/ }),

/***/ 635:
/***/ ((module) => {

"use strict";


module.exports = (flag, argv = process.argv) => {
	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
	const position = argv.indexOf(prefix + flag);
	const terminatorPosition = argv.indexOf('--');
	return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
};


/***/ }),

/***/ 4251:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const net_1 = __importDefault(__webpack_require__(1808));
const tls_1 = __importDefault(__webpack_require__(4404));
const url_1 = __importDefault(__webpack_require__(7310));
const assert_1 = __importDefault(__webpack_require__(9491));
const debug_1 = __importDefault(__webpack_require__(7564));
const agent_base_1 = __webpack_require__(8249);
const parse_proxy_response_1 = __importDefault(__webpack_require__(8943));
const debug = debug_1.default('https-proxy-agent:agent');
/**
 * The `HttpsProxyAgent` implements an HTTP Agent subclass that connects to
 * the specified "HTTP(s) proxy server" in order to proxy HTTPS requests.
 *
 * Outgoing HTTP requests are first tunneled through the proxy server using the
 * `CONNECT` HTTP request method to establish a connection to the proxy server,
 * and then the proxy server connects to the destination target and issues the
 * HTTP request from the proxy server.
 *
 * `https:` requests have their socket connection upgraded to TLS once
 * the connection to the proxy server has been established.
 *
 * @api public
 */
class HttpsProxyAgent extends agent_base_1.Agent {
    constructor(_opts) {
        let opts;
        if (typeof _opts === 'string') {
            opts = url_1.default.parse(_opts);
        }
        else {
            opts = _opts;
        }
        if (!opts) {
            throw new Error('an HTTP(S) proxy server `host` and `port` must be specified!');
        }
        debug('creating new HttpsProxyAgent instance: %o', opts);
        super(opts);
        const proxy = Object.assign({}, opts);
        // If `true`, then connect to the proxy server over TLS.
        // Defaults to `false`.
        this.secureProxy = opts.secureProxy || isHTTPS(proxy.protocol);
        // Prefer `hostname` over `host`, and set the `port` if needed.
        proxy.host = proxy.hostname || proxy.host;
        if (typeof proxy.port === 'string') {
            proxy.port = parseInt(proxy.port, 10);
        }
        if (!proxy.port && proxy.host) {
            proxy.port = this.secureProxy ? 443 : 80;
        }
        // ALPN is supported by Node.js >= v5.
        // attempt to negotiate http/1.1 for proxy servers that support http/2
        if (this.secureProxy && !('ALPNProtocols' in proxy)) {
            proxy.ALPNProtocols = ['http 1.1'];
        }
        if (proxy.host && proxy.path) {
            // If both a `host` and `path` are specified then it's most likely
            // the result of a `url.parse()` call... we need to remove the
            // `path` portion so that `net.connect()` doesn't attempt to open
            // that as a Unix socket file.
            delete proxy.path;
            delete proxy.pathname;
        }
        this.proxy = proxy;
    }
    /**
     * Called when the node-core HTTP client library is creating a
     * new HTTP request.
     *
     * @api protected
     */
    callback(req, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const { proxy, secureProxy } = this;
            // Create a socket connection to the proxy server.
            let socket;
            if (secureProxy) {
                debug('Creating `tls.Socket`: %o', proxy);
                socket = tls_1.default.connect(proxy);
            }
            else {
                debug('Creating `net.Socket`: %o', proxy);
                socket = net_1.default.connect(proxy);
            }
            const headers = Object.assign({}, proxy.headers);
            const hostname = `${opts.host}:${opts.port}`;
            let payload = `CONNECT ${hostname} HTTP/1.1\r\n`;
            // Inject the `Proxy-Authorization` header if necessary.
            if (proxy.auth) {
                headers['Proxy-Authorization'] = `Basic ${Buffer.from(proxy.auth).toString('base64')}`;
            }
            // The `Host` header should only include the port
            // number when it is not the default port.
            let { host, port, secureEndpoint } = opts;
            if (!isDefaultPort(port, secureEndpoint)) {
                host += `:${port}`;
            }
            headers.Host = host;
            headers.Connection = 'close';
            for (const name of Object.keys(headers)) {
                payload += `${name}: ${headers[name]}\r\n`;
            }
            const proxyResponsePromise = parse_proxy_response_1.default(socket);
            socket.write(`${payload}\r\n`);
            const { statusCode, buffered } = yield proxyResponsePromise;
            if (statusCode === 200) {
                req.once('socket', resume);
                if (opts.secureEndpoint) {
                    // The proxy is connecting to a TLS server, so upgrade
                    // this socket connection to a TLS connection.
                    debug('Upgrading socket connection to TLS');
                    const servername = opts.servername || opts.host;
                    return tls_1.default.connect(Object.assign(Object.assign({}, omit(opts, 'host', 'hostname', 'path', 'port')), { socket,
                        servername }));
                }
                return socket;
            }
            // Some other status code that's not 200... need to re-play the HTTP
            // header "data" events onto the socket once the HTTP machinery is
            // attached so that the node core `http` can parse and handle the
            // error status code.
            // Close the original socket, and a new "fake" socket is returned
            // instead, so that the proxy doesn't get the HTTP request
            // written to it (which may contain `Authorization` headers or other
            // sensitive data).
            //
            // See: https://hackerone.com/reports/541502
            socket.destroy();
            const fakeSocket = new net_1.default.Socket({ writable: false });
            fakeSocket.readable = true;
            // Need to wait for the "socket" event to re-play the "data" events.
            req.once('socket', (s) => {
                debug('replaying proxy buffer for failed request');
                assert_1.default(s.listenerCount('data') > 0);
                // Replay the "buffered" Buffer onto the fake `socket`, since at
                // this point the HTTP module machinery has been hooked up for
                // the user.
                s.push(buffered);
                s.push(null);
            });
            return fakeSocket;
        });
    }
}
exports["default"] = HttpsProxyAgent;
function resume(socket) {
    socket.resume();
}
function isDefaultPort(port, secure) {
    return Boolean((!secure && port === 80) || (secure && port === 443));
}
function isHTTPS(protocol) {
    return typeof protocol === 'string' ? /^https:?$/i.test(protocol) : false;
}
function omit(obj, ...keys) {
    const ret = {};
    let key;
    for (key in obj) {
        if (!keys.includes(key)) {
            ret[key] = obj[key];
        }
    }
    return ret;
}
//# sourceMappingURL=agent.js.map

/***/ }),

/***/ 2403:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const agent_1 = __importDefault(__webpack_require__(4251));
function createHttpsProxyAgent(opts) {
    return new agent_1.default(opts);
}
(function (createHttpsProxyAgent) {
    createHttpsProxyAgent.HttpsProxyAgent = agent_1.default;
    createHttpsProxyAgent.prototype = agent_1.default.prototype;
})(createHttpsProxyAgent || (createHttpsProxyAgent = {}));
module.exports = createHttpsProxyAgent;
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 8943:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const debug_1 = __importDefault(__webpack_require__(7564));
const debug = debug_1.default('https-proxy-agent:parse-proxy-response');
function parseProxyResponse(socket) {
    return new Promise((resolve, reject) => {
        // we need to buffer any HTTP traffic that happens with the proxy before we get
        // the CONNECT response, so that if the response is anything other than an "200"
        // response code, then we can re-play the "data" events on the socket once the
        // HTTP parser is hooked up...
        let buffersLength = 0;
        const buffers = [];
        function read() {
            const b = socket.read();
            if (b)
                ondata(b);
            else
                socket.once('readable', read);
        }
        function cleanup() {
            socket.removeListener('end', onend);
            socket.removeListener('error', onerror);
            socket.removeListener('close', onclose);
            socket.removeListener('readable', read);
        }
        function onclose(err) {
            debug('onclose had error %o', err);
        }
        function onend() {
            debug('onend');
        }
        function onerror(err) {
            cleanup();
            debug('onerror %o', err);
            reject(err);
        }
        function ondata(b) {
            buffers.push(b);
            buffersLength += b.length;
            const buffered = Buffer.concat(buffers, buffersLength);
            const endOfHeaders = buffered.indexOf('\r\n\r\n');
            if (endOfHeaders === -1) {
                // keep buffering
                debug('have not received end of HTTP headers yet...');
                read();
                return;
            }
            const firstLine = buffered.toString('ascii', 0, buffered.indexOf('\r\n'));
            const statusCode = +firstLine.split(' ')[1];
            debug('got proxy server response: %o', firstLine);
            resolve({
                statusCode,
                buffered
            });
        }
        socket.on('error', onerror);
        socket.on('close', onclose);
        socket.on('end', onend);
        read();
    });
}
exports["default"] = parseProxyResponse;
//# sourceMappingURL=parse-proxy-response.js.map

/***/ }),

/***/ 6809:
/***/ ((module) => {

/*!
    localForage -- Offline Storage, Improved
    Version 1.10.0
    https://localforage.github.io/localForage
    (c) 2013-2017 Mozilla, Apache License 2.0
*/
(function(f){if(true){module.exports=f()}else { var g; }})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=undefined;if(!u&&a)return require(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw (f.code="MODULE_NOT_FOUND", f)}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=undefined;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
(function (global){
'use strict';
var Mutation = global.MutationObserver || global.WebKitMutationObserver;

var scheduleDrain;

{
  if (Mutation) {
    var called = 0;
    var observer = new Mutation(nextTick);
    var element = global.document.createTextNode('');
    observer.observe(element, {
      characterData: true
    });
    scheduleDrain = function () {
      element.data = (called = ++called % 2);
    };
  } else if (!global.setImmediate && typeof global.MessageChannel !== 'undefined') {
    var channel = new global.MessageChannel();
    channel.port1.onmessage = nextTick;
    scheduleDrain = function () {
      channel.port2.postMessage(0);
    };
  } else if ('document' in global && 'onreadystatechange' in global.document.createElement('script')) {
    scheduleDrain = function () {

      // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
      // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
      var scriptEl = global.document.createElement('script');
      scriptEl.onreadystatechange = function () {
        nextTick();

        scriptEl.onreadystatechange = null;
        scriptEl.parentNode.removeChild(scriptEl);
        scriptEl = null;
      };
      global.document.documentElement.appendChild(scriptEl);
    };
  } else {
    scheduleDrain = function () {
      setTimeout(nextTick, 0);
    };
  }
}

var draining;
var queue = [];
//named nextTick for less confusing stack traces
function nextTick() {
  draining = true;
  var i, oldQueue;
  var len = queue.length;
  while (len) {
    oldQueue = queue;
    queue = [];
    i = -1;
    while (++i < len) {
      oldQueue[i]();
    }
    len = queue.length;
  }
  draining = false;
}

module.exports = immediate;
function immediate(task) {
  if (queue.push(task) === 1 && !draining) {
    scheduleDrain();
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],2:[function(_dereq_,module,exports){
'use strict';
var immediate = _dereq_(1);

/* istanbul ignore next */
function INTERNAL() {}

var handlers = {};

var REJECTED = ['REJECTED'];
var FULFILLED = ['FULFILLED'];
var PENDING = ['PENDING'];

module.exports = Promise;

function Promise(resolver) {
  if (typeof resolver !== 'function') {
    throw new TypeError('resolver must be a function');
  }
  this.state = PENDING;
  this.queue = [];
  this.outcome = void 0;
  if (resolver !== INTERNAL) {
    safelyResolveThenable(this, resolver);
  }
}

Promise.prototype["catch"] = function (onRejected) {
  return this.then(null, onRejected);
};
Promise.prototype.then = function (onFulfilled, onRejected) {
  if (typeof onFulfilled !== 'function' && this.state === FULFILLED ||
    typeof onRejected !== 'function' && this.state === REJECTED) {
    return this;
  }
  var promise = new this.constructor(INTERNAL);
  if (this.state !== PENDING) {
    var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
    unwrap(promise, resolver, this.outcome);
  } else {
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
  }

  return promise;
};
function QueueItem(promise, onFulfilled, onRejected) {
  this.promise = promise;
  if (typeof onFulfilled === 'function') {
    this.onFulfilled = onFulfilled;
    this.callFulfilled = this.otherCallFulfilled;
  }
  if (typeof onRejected === 'function') {
    this.onRejected = onRejected;
    this.callRejected = this.otherCallRejected;
  }
}
QueueItem.prototype.callFulfilled = function (value) {
  handlers.resolve(this.promise, value);
};
QueueItem.prototype.otherCallFulfilled = function (value) {
  unwrap(this.promise, this.onFulfilled, value);
};
QueueItem.prototype.callRejected = function (value) {
  handlers.reject(this.promise, value);
};
QueueItem.prototype.otherCallRejected = function (value) {
  unwrap(this.promise, this.onRejected, value);
};

function unwrap(promise, func, value) {
  immediate(function () {
    var returnValue;
    try {
      returnValue = func(value);
    } catch (e) {
      return handlers.reject(promise, e);
    }
    if (returnValue === promise) {
      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      handlers.resolve(promise, returnValue);
    }
  });
}

handlers.resolve = function (self, value) {
  var result = tryCatch(getThen, value);
  if (result.status === 'error') {
    return handlers.reject(self, result.value);
  }
  var thenable = result.value;

  if (thenable) {
    safelyResolveThenable(self, thenable);
  } else {
    self.state = FULFILLED;
    self.outcome = value;
    var i = -1;
    var len = self.queue.length;
    while (++i < len) {
      self.queue[i].callFulfilled(value);
    }
  }
  return self;
};
handlers.reject = function (self, error) {
  self.state = REJECTED;
  self.outcome = error;
  var i = -1;
  var len = self.queue.length;
  while (++i < len) {
    self.queue[i].callRejected(error);
  }
  return self;
};

function getThen(obj) {
  // Make sure we only access the accessor once as required by the spec
  var then = obj && obj.then;
  if (obj && (typeof obj === 'object' || typeof obj === 'function') && typeof then === 'function') {
    return function appyThen() {
      then.apply(obj, arguments);
    };
  }
}

function safelyResolveThenable(self, thenable) {
  // Either fulfill, reject or reject with error
  var called = false;
  function onError(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.reject(self, value);
  }

  function onSuccess(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.resolve(self, value);
  }

  function tryToUnwrap() {
    thenable(onSuccess, onError);
  }

  var result = tryCatch(tryToUnwrap);
  if (result.status === 'error') {
    onError(result.value);
  }
}

function tryCatch(func, value) {
  var out = {};
  try {
    out.value = func(value);
    out.status = 'success';
  } catch (e) {
    out.status = 'error';
    out.value = e;
  }
  return out;
}

Promise.resolve = resolve;
function resolve(value) {
  if (value instanceof this) {
    return value;
  }
  return handlers.resolve(new this(INTERNAL), value);
}

Promise.reject = reject;
function reject(reason) {
  var promise = new this(INTERNAL);
  return handlers.reject(promise, reason);
}

Promise.all = all;
function all(iterable) {
  var self = this;
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return this.reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return this.resolve([]);
  }

  var values = new Array(len);
  var resolved = 0;
  var i = -1;
  var promise = new this(INTERNAL);

  while (++i < len) {
    allResolver(iterable[i], i);
  }
  return promise;
  function allResolver(value, i) {
    self.resolve(value).then(resolveFromAll, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
    function resolveFromAll(outValue) {
      values[i] = outValue;
      if (++resolved === len && !called) {
        called = true;
        handlers.resolve(promise, values);
      }
    }
  }
}

Promise.race = race;
function race(iterable) {
  var self = this;
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return this.reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return this.resolve([]);
  }

  var i = -1;
  var promise = new this(INTERNAL);

  while (++i < len) {
    resolver(iterable[i]);
  }
  return promise;
  function resolver(value) {
    self.resolve(value).then(function (response) {
      if (!called) {
        called = true;
        handlers.resolve(promise, response);
      }
    }, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
  }
}

},{"1":1}],3:[function(_dereq_,module,exports){
(function (global){
'use strict';
if (typeof global.Promise !== 'function') {
  global.Promise = _dereq_(2);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"2":2}],4:[function(_dereq_,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function getIDB() {
    /* global indexedDB,webkitIndexedDB,mozIndexedDB,OIndexedDB,msIndexedDB */
    try {
        if (typeof indexedDB !== 'undefined') {
            return indexedDB;
        }
        if (typeof webkitIndexedDB !== 'undefined') {
            return webkitIndexedDB;
        }
        if (typeof mozIndexedDB !== 'undefined') {
            return mozIndexedDB;
        }
        if (typeof OIndexedDB !== 'undefined') {
            return OIndexedDB;
        }
        if (typeof msIndexedDB !== 'undefined') {
            return msIndexedDB;
        }
    } catch (e) {
        return;
    }
}

var idb = getIDB();

function isIndexedDBValid() {
    try {
        // Initialize IndexedDB; fall back to vendor-prefixed versions
        // if needed.
        if (!idb || !idb.open) {
            return false;
        }
        // We mimic PouchDB here;
        //
        // We test for openDatabase because IE Mobile identifies itself
        // as Safari. Oh the lulz...
        var isSafari = typeof openDatabase !== 'undefined' && /(Safari|iPhone|iPad|iPod)/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && !/BlackBerry/.test(navigator.platform);

        var hasFetch = typeof fetch === 'function' && fetch.toString().indexOf('[native code') !== -1;

        // Safari <10.1 does not meet our requirements for IDB support
        // (see: https://github.com/pouchdb/pouchdb/issues/5572).
        // Safari 10.1 shipped with fetch, we can use that to detect it.
        // Note: this creates issues with `window.fetch` polyfills and
        // overrides; see:
        // https://github.com/localForage/localForage/issues/856
        return (!isSafari || hasFetch) && typeof indexedDB !== 'undefined' &&
        // some outdated implementations of IDB that appear on Samsung
        // and HTC Android devices <4.4 are missing IDBKeyRange
        // See: https://github.com/mozilla/localForage/issues/128
        // See: https://github.com/mozilla/localForage/issues/272
        typeof IDBKeyRange !== 'undefined';
    } catch (e) {
        return false;
    }
}

// Abstracts constructing a Blob object, so it also works in older
// browsers that don't support the native Blob constructor. (i.e.
// old QtWebKit versions, at least).
// Abstracts constructing a Blob object, so it also works in older
// browsers that don't support the native Blob constructor. (i.e.
// old QtWebKit versions, at least).
function createBlob(parts, properties) {
    /* global BlobBuilder,MSBlobBuilder,MozBlobBuilder,WebKitBlobBuilder */
    parts = parts || [];
    properties = properties || {};
    try {
        return new Blob(parts, properties);
    } catch (e) {
        if (e.name !== 'TypeError') {
            throw e;
        }
        var Builder = typeof BlobBuilder !== 'undefined' ? BlobBuilder : typeof MSBlobBuilder !== 'undefined' ? MSBlobBuilder : typeof MozBlobBuilder !== 'undefined' ? MozBlobBuilder : WebKitBlobBuilder;
        var builder = new Builder();
        for (var i = 0; i < parts.length; i += 1) {
            builder.append(parts[i]);
        }
        return builder.getBlob(properties.type);
    }
}

// This is CommonJS because lie is an external dependency, so Rollup
// can just ignore it.
if (typeof Promise === 'undefined') {
    // In the "nopromises" build this will just throw if you don't have
    // a global promise object, but it would throw anyway later.
    _dereq_(3);
}
var Promise$1 = Promise;

function executeCallback(promise, callback) {
    if (callback) {
        promise.then(function (result) {
            callback(null, result);
        }, function (error) {
            callback(error);
        });
    }
}

function executeTwoCallbacks(promise, callback, errorCallback) {
    if (typeof callback === 'function') {
        promise.then(callback);
    }

    if (typeof errorCallback === 'function') {
        promise["catch"](errorCallback);
    }
}

function normalizeKey(key) {
    // Cast the key to a string, as that's all we can set as a key.
    if (typeof key !== 'string') {
        console.warn(key + ' used as a key, but it is not a string.');
        key = String(key);
    }

    return key;
}

function getCallback() {
    if (arguments.length && typeof arguments[arguments.length - 1] === 'function') {
        return arguments[arguments.length - 1];
    }
}

// Some code originally from async_storage.js in
// [Gaia](https://github.com/mozilla-b2g/gaia).

var DETECT_BLOB_SUPPORT_STORE = 'local-forage-detect-blob-support';
var supportsBlobs = void 0;
var dbContexts = {};
var toString = Object.prototype.toString;

// Transaction Modes
var READ_ONLY = 'readonly';
var READ_WRITE = 'readwrite';

// Transform a binary string to an array buffer, because otherwise
// weird stuff happens when you try to work with the binary string directly.
// It is known.
// From http://stackoverflow.com/questions/14967647/ (continues on next line)
// encode-decode-image-with-base64-breaks-image (2013-04-21)
function _binStringToArrayBuffer(bin) {
    var length = bin.length;
    var buf = new ArrayBuffer(length);
    var arr = new Uint8Array(buf);
    for (var i = 0; i < length; i++) {
        arr[i] = bin.charCodeAt(i);
    }
    return buf;
}

//
// Blobs are not supported in all versions of IndexedDB, notably
// Chrome <37 and Android <5. In those versions, storing a blob will throw.
//
// Various other blob bugs exist in Chrome v37-42 (inclusive).
// Detecting them is expensive and confusing to users, and Chrome 37-42
// is at very low usage worldwide, so we do a hacky userAgent check instead.
//
// content-type bug: https://code.google.com/p/chromium/issues/detail?id=408120
// 404 bug: https://code.google.com/p/chromium/issues/detail?id=447916
// FileReader bug: https://code.google.com/p/chromium/issues/detail?id=447836
//
// Code borrowed from PouchDB. See:
// https://github.com/pouchdb/pouchdb/blob/master/packages/node_modules/pouchdb-adapter-idb/src/blobSupport.js
//
function _checkBlobSupportWithoutCaching(idb) {
    return new Promise$1(function (resolve) {
        var txn = idb.transaction(DETECT_BLOB_SUPPORT_STORE, READ_WRITE);
        var blob = createBlob(['']);
        txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, 'key');

        txn.onabort = function (e) {
            // If the transaction aborts now its due to not being able to
            // write to the database, likely due to the disk being full
            e.preventDefault();
            e.stopPropagation();
            resolve(false);
        };

        txn.oncomplete = function () {
            var matchedChrome = navigator.userAgent.match(/Chrome\/(\d+)/);
            var matchedEdge = navigator.userAgent.match(/Edge\//);
            // MS Edge pretends to be Chrome 42:
            // https://msdn.microsoft.com/en-us/library/hh869301%28v=vs.85%29.aspx
            resolve(matchedEdge || !matchedChrome || parseInt(matchedChrome[1], 10) >= 43);
        };
    })["catch"](function () {
        return false; // error, so assume unsupported
    });
}

function _checkBlobSupport(idb) {
    if (typeof supportsBlobs === 'boolean') {
        return Promise$1.resolve(supportsBlobs);
    }
    return _checkBlobSupportWithoutCaching(idb).then(function (value) {
        supportsBlobs = value;
        return supportsBlobs;
    });
}

function _deferReadiness(dbInfo) {
    var dbContext = dbContexts[dbInfo.name];

    // Create a deferred object representing the current database operation.
    var deferredOperation = {};

    deferredOperation.promise = new Promise$1(function (resolve, reject) {
        deferredOperation.resolve = resolve;
        deferredOperation.reject = reject;
    });

    // Enqueue the deferred operation.
    dbContext.deferredOperations.push(deferredOperation);

    // Chain its promise to the database readiness.
    if (!dbContext.dbReady) {
        dbContext.dbReady = deferredOperation.promise;
    } else {
        dbContext.dbReady = dbContext.dbReady.then(function () {
            return deferredOperation.promise;
        });
    }
}

function _advanceReadiness(dbInfo) {
    var dbContext = dbContexts[dbInfo.name];

    // Dequeue a deferred operation.
    var deferredOperation = dbContext.deferredOperations.pop();

    // Resolve its promise (which is part of the database readiness
    // chain of promises).
    if (deferredOperation) {
        deferredOperation.resolve();
        return deferredOperation.promise;
    }
}

function _rejectReadiness(dbInfo, err) {
    var dbContext = dbContexts[dbInfo.name];

    // Dequeue a deferred operation.
    var deferredOperation = dbContext.deferredOperations.pop();

    // Reject its promise (which is part of the database readiness
    // chain of promises).
    if (deferredOperation) {
        deferredOperation.reject(err);
        return deferredOperation.promise;
    }
}

function _getConnection(dbInfo, upgradeNeeded) {
    return new Promise$1(function (resolve, reject) {
        dbContexts[dbInfo.name] = dbContexts[dbInfo.name] || createDbContext();

        if (dbInfo.db) {
            if (upgradeNeeded) {
                _deferReadiness(dbInfo);
                dbInfo.db.close();
            } else {
                return resolve(dbInfo.db);
            }
        }

        var dbArgs = [dbInfo.name];

        if (upgradeNeeded) {
            dbArgs.push(dbInfo.version);
        }

        var openreq = idb.open.apply(idb, dbArgs);

        if (upgradeNeeded) {
            openreq.onupgradeneeded = function (e) {
                var db = openreq.result;
                try {
                    db.createObjectStore(dbInfo.storeName);
                    if (e.oldVersion <= 1) {
                        // Added when support for blob shims was added
                        db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);
                    }
                } catch (ex) {
                    if (ex.name === 'ConstraintError') {
                        console.warn('The database "' + dbInfo.name + '"' + ' has been upgraded from version ' + e.oldVersion + ' to version ' + e.newVersion + ', but the storage "' + dbInfo.storeName + '" already exists.');
                    } else {
                        throw ex;
                    }
                }
            };
        }

        openreq.onerror = function (e) {
            e.preventDefault();
            reject(openreq.error);
        };

        openreq.onsuccess = function () {
            var db = openreq.result;
            db.onversionchange = function (e) {
                // Triggered when the database is modified (e.g. adding an objectStore) or
                // deleted (even when initiated by other sessions in different tabs).
                // Closing the connection here prevents those operations from being blocked.
                // If the database is accessed again later by this instance, the connection
                // will be reopened or the database recreated as needed.
                e.target.close();
            };
            resolve(db);
            _advanceReadiness(dbInfo);
        };
    });
}

function _getOriginalConnection(dbInfo) {
    return _getConnection(dbInfo, false);
}

function _getUpgradedConnection(dbInfo) {
    return _getConnection(dbInfo, true);
}

function _isUpgradeNeeded(dbInfo, defaultVersion) {
    if (!dbInfo.db) {
        return true;
    }

    var isNewStore = !dbInfo.db.objectStoreNames.contains(dbInfo.storeName);
    var isDowngrade = dbInfo.version < dbInfo.db.version;
    var isUpgrade = dbInfo.version > dbInfo.db.version;

    if (isDowngrade) {
        // If the version is not the default one
        // then warn for impossible downgrade.
        if (dbInfo.version !== defaultVersion) {
            console.warn('The database "' + dbInfo.name + '"' + " can't be downgraded from version " + dbInfo.db.version + ' to version ' + dbInfo.version + '.');
        }
        // Align the versions to prevent errors.
        dbInfo.version = dbInfo.db.version;
    }

    if (isUpgrade || isNewStore) {
        // If the store is new then increment the version (if needed).
        // This will trigger an "upgradeneeded" event which is required
        // for creating a store.
        if (isNewStore) {
            var incVersion = dbInfo.db.version + 1;
            if (incVersion > dbInfo.version) {
                dbInfo.version = incVersion;
            }
        }

        return true;
    }

    return false;
}

// encode a blob for indexeddb engines that don't support blobs
function _encodeBlob(blob) {
    return new Promise$1(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = reject;
        reader.onloadend = function (e) {
            var base64 = btoa(e.target.result || '');
            resolve({
                __local_forage_encoded_blob: true,
                data: base64,
                type: blob.type
            });
        };
        reader.readAsBinaryString(blob);
    });
}

// decode an encoded blob
function _decodeBlob(encodedBlob) {
    var arrayBuff = _binStringToArrayBuffer(atob(encodedBlob.data));
    return createBlob([arrayBuff], { type: encodedBlob.type });
}

// is this one of our fancy encoded blobs?
function _isEncodedBlob(value) {
    return value && value.__local_forage_encoded_blob;
}

// Specialize the default `ready()` function by making it dependent
// on the current database operations. Thus, the driver will be actually
// ready when it's been initialized (default) *and* there are no pending
// operations on the database (initiated by some other instances).
function _fullyReady(callback) {
    var self = this;

    var promise = self._initReady().then(function () {
        var dbContext = dbContexts[self._dbInfo.name];

        if (dbContext && dbContext.dbReady) {
            return dbContext.dbReady;
        }
    });

    executeTwoCallbacks(promise, callback, callback);
    return promise;
}

// Try to establish a new db connection to replace the
// current one which is broken (i.e. experiencing
// InvalidStateError while creating a transaction).
function _tryReconnect(dbInfo) {
    _deferReadiness(dbInfo);

    var dbContext = dbContexts[dbInfo.name];
    var forages = dbContext.forages;

    for (var i = 0; i < forages.length; i++) {
        var forage = forages[i];
        if (forage._dbInfo.db) {
            forage._dbInfo.db.close();
            forage._dbInfo.db = null;
        }
    }
    dbInfo.db = null;

    return _getOriginalConnection(dbInfo).then(function (db) {
        dbInfo.db = db;
        if (_isUpgradeNeeded(dbInfo)) {
            // Reopen the database for upgrading.
            return _getUpgradedConnection(dbInfo);
        }
        return db;
    }).then(function (db) {
        // store the latest db reference
        // in case the db was upgraded
        dbInfo.db = dbContext.db = db;
        for (var i = 0; i < forages.length; i++) {
            forages[i]._dbInfo.db = db;
        }
    })["catch"](function (err) {
        _rejectReadiness(dbInfo, err);
        throw err;
    });
}

// FF doesn't like Promises (micro-tasks) and IDDB store operations,
// so we have to do it with callbacks
function createTransaction(dbInfo, mode, callback, retries) {
    if (retries === undefined) {
        retries = 1;
    }

    try {
        var tx = dbInfo.db.transaction(dbInfo.storeName, mode);
        callback(null, tx);
    } catch (err) {
        if (retries > 0 && (!dbInfo.db || err.name === 'InvalidStateError' || err.name === 'NotFoundError')) {
            return Promise$1.resolve().then(function () {
                if (!dbInfo.db || err.name === 'NotFoundError' && !dbInfo.db.objectStoreNames.contains(dbInfo.storeName) && dbInfo.version <= dbInfo.db.version) {
                    // increase the db version, to create the new ObjectStore
                    if (dbInfo.db) {
                        dbInfo.version = dbInfo.db.version + 1;
                    }
                    // Reopen the database for upgrading.
                    return _getUpgradedConnection(dbInfo);
                }
            }).then(function () {
                return _tryReconnect(dbInfo).then(function () {
                    createTransaction(dbInfo, mode, callback, retries - 1);
                });
            })["catch"](callback);
        }

        callback(err);
    }
}

function createDbContext() {
    return {
        // Running localForages sharing a database.
        forages: [],
        // Shared database.
        db: null,
        // Database readiness (promise).
        dbReady: null,
        // Deferred operations on the database.
        deferredOperations: []
    };
}

// Open the IndexedDB database (automatically creates one if one didn't
// previously exist), using any options set in the config.
function _initStorage(options) {
    var self = this;
    var dbInfo = {
        db: null
    };

    if (options) {
        for (var i in options) {
            dbInfo[i] = options[i];
        }
    }

    // Get the current context of the database;
    var dbContext = dbContexts[dbInfo.name];

    // ...or create a new context.
    if (!dbContext) {
        dbContext = createDbContext();
        // Register the new context in the global container.
        dbContexts[dbInfo.name] = dbContext;
    }

    // Register itself as a running localForage in the current context.
    dbContext.forages.push(self);

    // Replace the default `ready()` function with the specialized one.
    if (!self._initReady) {
        self._initReady = self.ready;
        self.ready = _fullyReady;
    }

    // Create an array of initialization states of the related localForages.
    var initPromises = [];

    function ignoreErrors() {
        // Don't handle errors here,
        // just makes sure related localForages aren't pending.
        return Promise$1.resolve();
    }

    for (var j = 0; j < dbContext.forages.length; j++) {
        var forage = dbContext.forages[j];
        if (forage !== self) {
            // Don't wait for itself...
            initPromises.push(forage._initReady()["catch"](ignoreErrors));
        }
    }

    // Take a snapshot of the related localForages.
    var forages = dbContext.forages.slice(0);

    // Initialize the connection process only when
    // all the related localForages aren't pending.
    return Promise$1.all(initPromises).then(function () {
        dbInfo.db = dbContext.db;
        // Get the connection or open a new one without upgrade.
        return _getOriginalConnection(dbInfo);
    }).then(function (db) {
        dbInfo.db = db;
        if (_isUpgradeNeeded(dbInfo, self._defaultConfig.version)) {
            // Reopen the database for upgrading.
            return _getUpgradedConnection(dbInfo);
        }
        return db;
    }).then(function (db) {
        dbInfo.db = dbContext.db = db;
        self._dbInfo = dbInfo;
        // Share the final connection amongst related localForages.
        for (var k = 0; k < forages.length; k++) {
            var forage = forages[k];
            if (forage !== self) {
                // Self is already up-to-date.
                forage._dbInfo.db = dbInfo.db;
                forage._dbInfo.version = dbInfo.version;
            }
        }
    });
}

function getItem(key, callback) {
    var self = this;

    key = normalizeKey(key);

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
                if (err) {
                    return reject(err);
                }

                try {
                    var store = transaction.objectStore(self._dbInfo.storeName);
                    var req = store.get(key);

                    req.onsuccess = function () {
                        var value = req.result;
                        if (value === undefined) {
                            value = null;
                        }
                        if (_isEncodedBlob(value)) {
                            value = _decodeBlob(value);
                        }
                        resolve(value);
                    };

                    req.onerror = function () {
                        reject(req.error);
                    };
                } catch (e) {
                    reject(e);
                }
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

// Iterate over all items stored in database.
function iterate(iterator, callback) {
    var self = this;

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
                if (err) {
                    return reject(err);
                }

                try {
                    var store = transaction.objectStore(self._dbInfo.storeName);
                    var req = store.openCursor();
                    var iterationNumber = 1;

                    req.onsuccess = function () {
                        var cursor = req.result;

                        if (cursor) {
                            var value = cursor.value;
                            if (_isEncodedBlob(value)) {
                                value = _decodeBlob(value);
                            }
                            var result = iterator(value, cursor.key, iterationNumber++);

                            // when the iterator callback returns any
                            // (non-`undefined`) value, then we stop
                            // the iteration immediately
                            if (result !== void 0) {
                                resolve(result);
                            } else {
                                cursor["continue"]();
                            }
                        } else {
                            resolve();
                        }
                    };

                    req.onerror = function () {
                        reject(req.error);
                    };
                } catch (e) {
                    reject(e);
                }
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);

    return promise;
}

function setItem(key, value, callback) {
    var self = this;

    key = normalizeKey(key);

    var promise = new Promise$1(function (resolve, reject) {
        var dbInfo;
        self.ready().then(function () {
            dbInfo = self._dbInfo;
            if (toString.call(value) === '[object Blob]') {
                return _checkBlobSupport(dbInfo.db).then(function (blobSupport) {
                    if (blobSupport) {
                        return value;
                    }
                    return _encodeBlob(value);
                });
            }
            return value;
        }).then(function (value) {
            createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
                if (err) {
                    return reject(err);
                }

                try {
                    var store = transaction.objectStore(self._dbInfo.storeName);

                    // The reason we don't _save_ null is because IE 10 does
                    // not support saving the `null` type in IndexedDB. How
                    // ironic, given the bug below!
                    // See: https://github.com/mozilla/localForage/issues/161
                    if (value === null) {
                        value = undefined;
                    }

                    var req = store.put(value, key);

                    transaction.oncomplete = function () {
                        // Cast to undefined so the value passed to
                        // callback/promise is the same as what one would get out
                        // of `getItem()` later. This leads to some weirdness
                        // (setItem('foo', undefined) will return `null`), but
                        // it's not my fault localStorage is our baseline and that
                        // it's weird.
                        if (value === undefined) {
                            value = null;
                        }

                        resolve(value);
                    };
                    transaction.onabort = transaction.onerror = function () {
                        var err = req.error ? req.error : req.transaction.error;
                        reject(err);
                    };
                } catch (e) {
                    reject(e);
                }
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function removeItem(key, callback) {
    var self = this;

    key = normalizeKey(key);

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
                if (err) {
                    return reject(err);
                }

                try {
                    var store = transaction.objectStore(self._dbInfo.storeName);
                    // We use a Grunt task to make this safe for IE and some
                    // versions of Android (including those used by Cordova).
                    // Normally IE won't like `.delete()` and will insist on
                    // using `['delete']()`, but we have a build step that
                    // fixes this for us now.
                    var req = store["delete"](key);
                    transaction.oncomplete = function () {
                        resolve();
                    };

                    transaction.onerror = function () {
                        reject(req.error);
                    };

                    // The request will be also be aborted if we've exceeded our storage
                    // space.
                    transaction.onabort = function () {
                        var err = req.error ? req.error : req.transaction.error;
                        reject(err);
                    };
                } catch (e) {
                    reject(e);
                }
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function clear(callback) {
    var self = this;

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
                if (err) {
                    return reject(err);
                }

                try {
                    var store = transaction.objectStore(self._dbInfo.storeName);
                    var req = store.clear();

                    transaction.oncomplete = function () {
                        resolve();
                    };

                    transaction.onabort = transaction.onerror = function () {
                        var err = req.error ? req.error : req.transaction.error;
                        reject(err);
                    };
                } catch (e) {
                    reject(e);
                }
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function length(callback) {
    var self = this;

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
                if (err) {
                    return reject(err);
                }

                try {
                    var store = transaction.objectStore(self._dbInfo.storeName);
                    var req = store.count();

                    req.onsuccess = function () {
                        resolve(req.result);
                    };

                    req.onerror = function () {
                        reject(req.error);
                    };
                } catch (e) {
                    reject(e);
                }
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function key(n, callback) {
    var self = this;

    var promise = new Promise$1(function (resolve, reject) {
        if (n < 0) {
            resolve(null);

            return;
        }

        self.ready().then(function () {
            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
                if (err) {
                    return reject(err);
                }

                try {
                    var store = transaction.objectStore(self._dbInfo.storeName);
                    var advanced = false;
                    var req = store.openKeyCursor();

                    req.onsuccess = function () {
                        var cursor = req.result;
                        if (!cursor) {
                            // this means there weren't enough keys
                            resolve(null);

                            return;
                        }

                        if (n === 0) {
                            // We have the first key, return it if that's what they
                            // wanted.
                            resolve(cursor.key);
                        } else {
                            if (!advanced) {
                                // Otherwise, ask the cursor to skip ahead n
                                // records.
                                advanced = true;
                                cursor.advance(n);
                            } else {
                                // When we get here, we've got the nth key.
                                resolve(cursor.key);
                            }
                        }
                    };

                    req.onerror = function () {
                        reject(req.error);
                    };
                } catch (e) {
                    reject(e);
                }
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function keys(callback) {
    var self = this;

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
                if (err) {
                    return reject(err);
                }

                try {
                    var store = transaction.objectStore(self._dbInfo.storeName);
                    var req = store.openKeyCursor();
                    var keys = [];

                    req.onsuccess = function () {
                        var cursor = req.result;

                        if (!cursor) {
                            resolve(keys);
                            return;
                        }

                        keys.push(cursor.key);
                        cursor["continue"]();
                    };

                    req.onerror = function () {
                        reject(req.error);
                    };
                } catch (e) {
                    reject(e);
                }
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function dropInstance(options, callback) {
    callback = getCallback.apply(this, arguments);

    var currentConfig = this.config();
    options = typeof options !== 'function' && options || {};
    if (!options.name) {
        options.name = options.name || currentConfig.name;
        options.storeName = options.storeName || currentConfig.storeName;
    }

    var self = this;
    var promise;
    if (!options.name) {
        promise = Promise$1.reject('Invalid arguments');
    } else {
        var isCurrentDb = options.name === currentConfig.name && self._dbInfo.db;

        var dbPromise = isCurrentDb ? Promise$1.resolve(self._dbInfo.db) : _getOriginalConnection(options).then(function (db) {
            var dbContext = dbContexts[options.name];
            var forages = dbContext.forages;
            dbContext.db = db;
            for (var i = 0; i < forages.length; i++) {
                forages[i]._dbInfo.db = db;
            }
            return db;
        });

        if (!options.storeName) {
            promise = dbPromise.then(function (db) {
                _deferReadiness(options);

                var dbContext = dbContexts[options.name];
                var forages = dbContext.forages;

                db.close();
                for (var i = 0; i < forages.length; i++) {
                    var forage = forages[i];
                    forage._dbInfo.db = null;
                }

                var dropDBPromise = new Promise$1(function (resolve, reject) {
                    var req = idb.deleteDatabase(options.name);

                    req.onerror = function () {
                        var db = req.result;
                        if (db) {
                            db.close();
                        }
                        reject(req.error);
                    };

                    req.onblocked = function () {
                        // Closing all open connections in onversionchange handler should prevent this situation, but if
                        // we do get here, it just means the request remains pending - eventually it will succeed or error
                        console.warn('dropInstance blocked for database "' + options.name + '" until all open connections are closed');
                    };

                    req.onsuccess = function () {
                        var db = req.result;
                        if (db) {
                            db.close();
                        }
                        resolve(db);
                    };
                });

                return dropDBPromise.then(function (db) {
                    dbContext.db = db;
                    for (var i = 0; i < forages.length; i++) {
                        var _forage = forages[i];
                        _advanceReadiness(_forage._dbInfo);
                    }
                })["catch"](function (err) {
                    (_rejectReadiness(options, err) || Promise$1.resolve())["catch"](function () {});
                    throw err;
                });
            });
        } else {
            promise = dbPromise.then(function (db) {
                if (!db.objectStoreNames.contains(options.storeName)) {
                    return;
                }

                var newVersion = db.version + 1;

                _deferReadiness(options);

                var dbContext = dbContexts[options.name];
                var forages = dbContext.forages;

                db.close();
                for (var i = 0; i < forages.length; i++) {
                    var forage = forages[i];
                    forage._dbInfo.db = null;
                    forage._dbInfo.version = newVersion;
                }

                var dropObjectPromise = new Promise$1(function (resolve, reject) {
                    var req = idb.open(options.name, newVersion);

                    req.onerror = function (err) {
                        var db = req.result;
                        db.close();
                        reject(err);
                    };

                    req.onupgradeneeded = function () {
                        var db = req.result;
                        db.deleteObjectStore(options.storeName);
                    };

                    req.onsuccess = function () {
                        var db = req.result;
                        db.close();
                        resolve(db);
                    };
                });

                return dropObjectPromise.then(function (db) {
                    dbContext.db = db;
                    for (var j = 0; j < forages.length; j++) {
                        var _forage2 = forages[j];
                        _forage2._dbInfo.db = db;
                        _advanceReadiness(_forage2._dbInfo);
                    }
                })["catch"](function (err) {
                    (_rejectReadiness(options, err) || Promise$1.resolve())["catch"](function () {});
                    throw err;
                });
            });
        }
    }

    executeCallback(promise, callback);
    return promise;
}

var asyncStorage = {
    _driver: 'asyncStorage',
    _initStorage: _initStorage,
    _support: isIndexedDBValid(),
    iterate: iterate,
    getItem: getItem,
    setItem: setItem,
    removeItem: removeItem,
    clear: clear,
    length: length,
    key: key,
    keys: keys,
    dropInstance: dropInstance
};

function isWebSQLValid() {
    return typeof openDatabase === 'function';
}

// Sadly, the best way to save binary data in WebSQL/localStorage is serializing
// it to Base64, so this is how we store it to prevent very strange errors with less
// verbose ways of binary <-> string data storage.
var BASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

var BLOB_TYPE_PREFIX = '~~local_forage_type~';
var BLOB_TYPE_PREFIX_REGEX = /^~~local_forage_type~([^~]+)~/;

var SERIALIZED_MARKER = '__lfsc__:';
var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;

// OMG the serializations!
var TYPE_ARRAYBUFFER = 'arbf';
var TYPE_BLOB = 'blob';
var TYPE_INT8ARRAY = 'si08';
var TYPE_UINT8ARRAY = 'ui08';
var TYPE_UINT8CLAMPEDARRAY = 'uic8';
var TYPE_INT16ARRAY = 'si16';
var TYPE_INT32ARRAY = 'si32';
var TYPE_UINT16ARRAY = 'ur16';
var TYPE_UINT32ARRAY = 'ui32';
var TYPE_FLOAT32ARRAY = 'fl32';
var TYPE_FLOAT64ARRAY = 'fl64';
var TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH + TYPE_ARRAYBUFFER.length;

var toString$1 = Object.prototype.toString;

function stringToBuffer(serializedString) {
    // Fill the string into a ArrayBuffer.
    var bufferLength = serializedString.length * 0.75;
    var len = serializedString.length;
    var i;
    var p = 0;
    var encoded1, encoded2, encoded3, encoded4;

    if (serializedString[serializedString.length - 1] === '=') {
        bufferLength--;
        if (serializedString[serializedString.length - 2] === '=') {
            bufferLength--;
        }
    }

    var buffer = new ArrayBuffer(bufferLength);
    var bytes = new Uint8Array(buffer);

    for (i = 0; i < len; i += 4) {
        encoded1 = BASE_CHARS.indexOf(serializedString[i]);
        encoded2 = BASE_CHARS.indexOf(serializedString[i + 1]);
        encoded3 = BASE_CHARS.indexOf(serializedString[i + 2]);
        encoded4 = BASE_CHARS.indexOf(serializedString[i + 3]);

        /*jslint bitwise: true */
        bytes[p++] = encoded1 << 2 | encoded2 >> 4;
        bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
        bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
    }
    return buffer;
}

// Converts a buffer to a string to store, serialized, in the backend
// storage library.
function bufferToString(buffer) {
    // base64-arraybuffer
    var bytes = new Uint8Array(buffer);
    var base64String = '';
    var i;

    for (i = 0; i < bytes.length; i += 3) {
        /*jslint bitwise: true */
        base64String += BASE_CHARS[bytes[i] >> 2];
        base64String += BASE_CHARS[(bytes[i] & 3) << 4 | bytes[i + 1] >> 4];
        base64String += BASE_CHARS[(bytes[i + 1] & 15) << 2 | bytes[i + 2] >> 6];
        base64String += BASE_CHARS[bytes[i + 2] & 63];
    }

    if (bytes.length % 3 === 2) {
        base64String = base64String.substring(0, base64String.length - 1) + '=';
    } else if (bytes.length % 3 === 1) {
        base64String = base64String.substring(0, base64String.length - 2) + '==';
    }

    return base64String;
}

// Serialize a value, afterwards executing a callback (which usually
// instructs the `setItem()` callback/promise to be executed). This is how
// we store binary data with localStorage.
function serialize(value, callback) {
    var valueType = '';
    if (value) {
        valueType = toString$1.call(value);
    }

    // Cannot use `value instanceof ArrayBuffer` or such here, as these
    // checks fail when running the tests using casper.js...
    //
    // TODO: See why those tests fail and use a better solution.
    if (value && (valueType === '[object ArrayBuffer]' || value.buffer && toString$1.call(value.buffer) === '[object ArrayBuffer]')) {
        // Convert binary arrays to a string and prefix the string with
        // a special marker.
        var buffer;
        var marker = SERIALIZED_MARKER;

        if (value instanceof ArrayBuffer) {
            buffer = value;
            marker += TYPE_ARRAYBUFFER;
        } else {
            buffer = value.buffer;

            if (valueType === '[object Int8Array]') {
                marker += TYPE_INT8ARRAY;
            } else if (valueType === '[object Uint8Array]') {
                marker += TYPE_UINT8ARRAY;
            } else if (valueType === '[object Uint8ClampedArray]') {
                marker += TYPE_UINT8CLAMPEDARRAY;
            } else if (valueType === '[object Int16Array]') {
                marker += TYPE_INT16ARRAY;
            } else if (valueType === '[object Uint16Array]') {
                marker += TYPE_UINT16ARRAY;
            } else if (valueType === '[object Int32Array]') {
                marker += TYPE_INT32ARRAY;
            } else if (valueType === '[object Uint32Array]') {
                marker += TYPE_UINT32ARRAY;
            } else if (valueType === '[object Float32Array]') {
                marker += TYPE_FLOAT32ARRAY;
            } else if (valueType === '[object Float64Array]') {
                marker += TYPE_FLOAT64ARRAY;
            } else {
                callback(new Error('Failed to get type for BinaryArray'));
            }
        }

        callback(marker + bufferToString(buffer));
    } else if (valueType === '[object Blob]') {
        // Conver the blob to a binaryArray and then to a string.
        var fileReader = new FileReader();

        fileReader.onload = function () {
            // Backwards-compatible prefix for the blob type.
            var str = BLOB_TYPE_PREFIX + value.type + '~' + bufferToString(this.result);

            callback(SERIALIZED_MARKER + TYPE_BLOB + str);
        };

        fileReader.readAsArrayBuffer(value);
    } else {
        try {
            callback(JSON.stringify(value));
        } catch (e) {
            console.error("Couldn't convert value into a JSON string: ", value);

            callback(null, e);
        }
    }
}

// Deserialize data we've inserted into a value column/field. We place
// special markers into our strings to mark them as encoded; this isn't
// as nice as a meta field, but it's the only sane thing we can do whilst
// keeping localStorage support intact.
//
// Oftentimes this will just deserialize JSON content, but if we have a
// special marker (SERIALIZED_MARKER, defined above), we will extract
// some kind of arraybuffer/binary data/typed array out of the string.
function deserialize(value) {
    // If we haven't marked this string as being specially serialized (i.e.
    // something other than serialized JSON), we can just return it and be
    // done with it.
    if (value.substring(0, SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
        return JSON.parse(value);
    }

    // The following code deals with deserializing some kind of Blob or
    // TypedArray. First we separate out the type of data we're dealing
    // with from the data itself.
    var serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
    var type = value.substring(SERIALIZED_MARKER_LENGTH, TYPE_SERIALIZED_MARKER_LENGTH);

    var blobType;
    // Backwards-compatible blob type serialization strategy.
    // DBs created with older versions of localForage will simply not have the blob type.
    if (type === TYPE_BLOB && BLOB_TYPE_PREFIX_REGEX.test(serializedString)) {
        var matcher = serializedString.match(BLOB_TYPE_PREFIX_REGEX);
        blobType = matcher[1];
        serializedString = serializedString.substring(matcher[0].length);
    }
    var buffer = stringToBuffer(serializedString);

    // Return the right type based on the code/type set during
    // serialization.
    switch (type) {
        case TYPE_ARRAYBUFFER:
            return buffer;
        case TYPE_BLOB:
            return createBlob([buffer], { type: blobType });
        case TYPE_INT8ARRAY:
            return new Int8Array(buffer);
        case TYPE_UINT8ARRAY:
            return new Uint8Array(buffer);
        case TYPE_UINT8CLAMPEDARRAY:
            return new Uint8ClampedArray(buffer);
        case TYPE_INT16ARRAY:
            return new Int16Array(buffer);
        case TYPE_UINT16ARRAY:
            return new Uint16Array(buffer);
        case TYPE_INT32ARRAY:
            return new Int32Array(buffer);
        case TYPE_UINT32ARRAY:
            return new Uint32Array(buffer);
        case TYPE_FLOAT32ARRAY:
            return new Float32Array(buffer);
        case TYPE_FLOAT64ARRAY:
            return new Float64Array(buffer);
        default:
            throw new Error('Unkown type: ' + type);
    }
}

var localforageSerializer = {
    serialize: serialize,
    deserialize: deserialize,
    stringToBuffer: stringToBuffer,
    bufferToString: bufferToString
};

/*
 * Includes code from:
 *
 * base64-arraybuffer
 * https://github.com/niklasvh/base64-arraybuffer
 *
 * Copyright (c) 2012 Niklas von Hertzen
 * Licensed under the MIT license.
 */

function createDbTable(t, dbInfo, callback, errorCallback) {
    t.executeSql('CREATE TABLE IF NOT EXISTS ' + dbInfo.storeName + ' ' + '(id INTEGER PRIMARY KEY, key unique, value)', [], callback, errorCallback);
}

// Open the WebSQL database (automatically creates one if one didn't
// previously exist), using any options set in the config.
function _initStorage$1(options) {
    var self = this;
    var dbInfo = {
        db: null
    };

    if (options) {
        for (var i in options) {
            dbInfo[i] = typeof options[i] !== 'string' ? options[i].toString() : options[i];
        }
    }

    var dbInfoPromise = new Promise$1(function (resolve, reject) {
        // Open the database; the openDatabase API will automatically
        // create it for us if it doesn't exist.
        try {
            dbInfo.db = openDatabase(dbInfo.name, String(dbInfo.version), dbInfo.description, dbInfo.size);
        } catch (e) {
            return reject(e);
        }

        // Create our key/value table if it doesn't exist.
        dbInfo.db.transaction(function (t) {
            createDbTable(t, dbInfo, function () {
                self._dbInfo = dbInfo;
                resolve();
            }, function (t, error) {
                reject(error);
            });
        }, reject);
    });

    dbInfo.serializer = localforageSerializer;
    return dbInfoPromise;
}

function tryExecuteSql(t, dbInfo, sqlStatement, args, callback, errorCallback) {
    t.executeSql(sqlStatement, args, callback, function (t, error) {
        if (error.code === error.SYNTAX_ERR) {
            t.executeSql('SELECT name FROM sqlite_master ' + "WHERE type='table' AND name = ?", [dbInfo.storeName], function (t, results) {
                if (!results.rows.length) {
                    // if the table is missing (was deleted)
                    // re-create it table and retry
                    createDbTable(t, dbInfo, function () {
                        t.executeSql(sqlStatement, args, callback, errorCallback);
                    }, errorCallback);
                } else {
                    errorCallback(t, error);
                }
            }, errorCallback);
        } else {
            errorCallback(t, error);
        }
    }, errorCallback);
}

function getItem$1(key, callback) {
    var self = this;

    key = normalizeKey(key);

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            var dbInfo = self._dbInfo;
            dbInfo.db.transaction(function (t) {
                tryExecuteSql(t, dbInfo, 'SELECT * FROM ' + dbInfo.storeName + ' WHERE key = ? LIMIT 1', [key], function (t, results) {
                    var result = results.rows.length ? results.rows.item(0).value : null;

                    // Check to see if this is serialized content we need to
                    // unpack.
                    if (result) {
                        result = dbInfo.serializer.deserialize(result);
                    }

                    resolve(result);
                }, function (t, error) {
                    reject(error);
                });
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function iterate$1(iterator, callback) {
    var self = this;

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            var dbInfo = self._dbInfo;

            dbInfo.db.transaction(function (t) {
                tryExecuteSql(t, dbInfo, 'SELECT * FROM ' + dbInfo.storeName, [], function (t, results) {
                    var rows = results.rows;
                    var length = rows.length;

                    for (var i = 0; i < length; i++) {
                        var item = rows.item(i);
                        var result = item.value;

                        // Check to see if this is serialized content
                        // we need to unpack.
                        if (result) {
                            result = dbInfo.serializer.deserialize(result);
                        }

                        result = iterator(result, item.key, i + 1);

                        // void(0) prevents problems with redefinition
                        // of `undefined`.
                        if (result !== void 0) {
                            resolve(result);
                            return;
                        }
                    }

                    resolve();
                }, function (t, error) {
                    reject(error);
                });
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function _setItem(key, value, callback, retriesLeft) {
    var self = this;

    key = normalizeKey(key);

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            // The localStorage API doesn't return undefined values in an
            // "expected" way, so undefined is always cast to null in all
            // drivers. See: https://github.com/mozilla/localForage/pull/42
            if (value === undefined) {
                value = null;
            }

            // Save the original value to pass to the callback.
            var originalValue = value;

            var dbInfo = self._dbInfo;
            dbInfo.serializer.serialize(value, function (value, error) {
                if (error) {
                    reject(error);
                } else {
                    dbInfo.db.transaction(function (t) {
                        tryExecuteSql(t, dbInfo, 'INSERT OR REPLACE INTO ' + dbInfo.storeName + ' ' + '(key, value) VALUES (?, ?)', [key, value], function () {
                            resolve(originalValue);
                        }, function (t, error) {
                            reject(error);
                        });
                    }, function (sqlError) {
                        // The transaction failed; check
                        // to see if it's a quota error.
                        if (sqlError.code === sqlError.QUOTA_ERR) {
                            // We reject the callback outright for now, but
                            // it's worth trying to re-run the transaction.
                            // Even if the user accepts the prompt to use
                            // more storage on Safari, this error will
                            // be called.
                            //
                            // Try to re-run the transaction.
                            if (retriesLeft > 0) {
                                resolve(_setItem.apply(self, [key, originalValue, callback, retriesLeft - 1]));
                                return;
                            }
                            reject(sqlError);
                        }
                    });
                }
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function setItem$1(key, value, callback) {
    return _setItem.apply(this, [key, value, callback, 1]);
}

function removeItem$1(key, callback) {
    var self = this;

    key = normalizeKey(key);

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            var dbInfo = self._dbInfo;
            dbInfo.db.transaction(function (t) {
                tryExecuteSql(t, dbInfo, 'DELETE FROM ' + dbInfo.storeName + ' WHERE key = ?', [key], function () {
                    resolve();
                }, function (t, error) {
                    reject(error);
                });
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

// Deletes every item in the table.
// TODO: Find out if this resets the AUTO_INCREMENT number.
function clear$1(callback) {
    var self = this;

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            var dbInfo = self._dbInfo;
            dbInfo.db.transaction(function (t) {
                tryExecuteSql(t, dbInfo, 'DELETE FROM ' + dbInfo.storeName, [], function () {
                    resolve();
                }, function (t, error) {
                    reject(error);
                });
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

// Does a simple `COUNT(key)` to get the number of items stored in
// localForage.
function length$1(callback) {
    var self = this;

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            var dbInfo = self._dbInfo;
            dbInfo.db.transaction(function (t) {
                // Ahhh, SQL makes this one soooooo easy.
                tryExecuteSql(t, dbInfo, 'SELECT COUNT(key) as c FROM ' + dbInfo.storeName, [], function (t, results) {
                    var result = results.rows.item(0).c;
                    resolve(result);
                }, function (t, error) {
                    reject(error);
                });
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

// Return the key located at key index X; essentially gets the key from a
// `WHERE id = ?`. This is the most efficient way I can think to implement
// this rarely-used (in my experience) part of the API, but it can seem
// inconsistent, because we do `INSERT OR REPLACE INTO` on `setItem()`, so
// the ID of each key will change every time it's updated. Perhaps a stored
// procedure for the `setItem()` SQL would solve this problem?
// TODO: Don't change ID on `setItem()`.
function key$1(n, callback) {
    var self = this;

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            var dbInfo = self._dbInfo;
            dbInfo.db.transaction(function (t) {
                tryExecuteSql(t, dbInfo, 'SELECT key FROM ' + dbInfo.storeName + ' WHERE id = ? LIMIT 1', [n + 1], function (t, results) {
                    var result = results.rows.length ? results.rows.item(0).key : null;
                    resolve(result);
                }, function (t, error) {
                    reject(error);
                });
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

function keys$1(callback) {
    var self = this;

    var promise = new Promise$1(function (resolve, reject) {
        self.ready().then(function () {
            var dbInfo = self._dbInfo;
            dbInfo.db.transaction(function (t) {
                tryExecuteSql(t, dbInfo, 'SELECT key FROM ' + dbInfo.storeName, [], function (t, results) {
                    var keys = [];

                    for (var i = 0; i < results.rows.length; i++) {
                        keys.push(results.rows.item(i).key);
                    }

                    resolve(keys);
                }, function (t, error) {
                    reject(error);
                });
            });
        })["catch"](reject);
    });

    executeCallback(promise, callback);
    return promise;
}

// https://www.w3.org/TR/webdatabase/#databases
// > There is no way to enumerate or delete the databases available for an origin from this API.
function getAllStoreNames(db) {
    return new Promise$1(function (resolve, reject) {
        db.transaction(function (t) {
            t.executeSql('SELECT name FROM sqlite_master ' + "WHERE type='table' AND name <> '__WebKitDatabaseInfoTable__'", [], function (t, results) {
                var storeNames = [];

                for (var i = 0; i < results.rows.length; i++) {
                    storeNames.push(results.rows.item(i).name);
                }

                resolve({
                    db: db,
                    storeNames: storeNames
                });
            }, function (t, error) {
                reject(error);
            });
        }, function (sqlError) {
            reject(sqlError);
        });
    });
}

function dropInstance$1(options, callback) {
    callback = getCallback.apply(this, arguments);

    var currentConfig = this.config();
    options = typeof options !== 'function' && options || {};
    if (!options.name) {
        options.name = options.name || currentConfig.name;
        options.storeName = options.storeName || currentConfig.storeName;
    }

    var self = this;
    var promise;
    if (!options.name) {
        promise = Promise$1.reject('Invalid arguments');
    } else {
        promise = new Promise$1(function (resolve) {
            var db;
            if (options.name === currentConfig.name) {
                // use the db reference of the current instance
                db = self._dbInfo.db;
            } else {
                db = openDatabase(options.name, '', '', 0);
            }

            if (!options.storeName) {
                // drop all database tables
                resolve(getAllStoreNames(db));
            } else {
                resolve({
                    db: db,
                    storeNames: [options.storeName]
                });
            }
        }).then(function (operationInfo) {
            return new Promise$1(function (resolve, reject) {
                operationInfo.db.transaction(function (t) {
                    function dropTable(storeName) {
                        return new Promise$1(function (resolve, reject) {
                            t.executeSql('DROP TABLE IF EXISTS ' + storeName, [], function () {
                                resolve();
                            }, function (t, error) {
                                reject(error);
                            });
                        });
                    }

                    var operations = [];
                    for (var i = 0, len = operationInfo.storeNames.length; i < len; i++) {
                        operations.push(dropTable(operationInfo.storeNames[i]));
                    }

                    Promise$1.all(operations).then(function () {
                        resolve();
                    })["catch"](function (e) {
                        reject(e);
                    });
                }, function (sqlError) {
                    reject(sqlError);
                });
            });
        });
    }

    executeCallback(promise, callback);
    return promise;
}

var webSQLStorage = {
    _driver: 'webSQLStorage',
    _initStorage: _initStorage$1,
    _support: isWebSQLValid(),
    iterate: iterate$1,
    getItem: getItem$1,
    setItem: setItem$1,
    removeItem: removeItem$1,
    clear: clear$1,
    length: length$1,
    key: key$1,
    keys: keys$1,
    dropInstance: dropInstance$1
};

function isLocalStorageValid() {
    try {
        return typeof localStorage !== 'undefined' && 'setItem' in localStorage &&
        // in IE8 typeof localStorage.setItem === 'object'
        !!localStorage.setItem;
    } catch (e) {
        return false;
    }
}

function _getKeyPrefix(options, defaultConfig) {
    var keyPrefix = options.name + '/';

    if (options.storeName !== defaultConfig.storeName) {
        keyPrefix += options.storeName + '/';
    }
    return keyPrefix;
}

// Check if localStorage throws when saving an item
function checkIfLocalStorageThrows() {
    var localStorageTestKey = '_localforage_support_test';

    try {
        localStorage.setItem(localStorageTestKey, true);
        localStorage.removeItem(localStorageTestKey);

        return false;
    } catch (e) {
        return true;
    }
}

// Check if localStorage is usable and allows to save an item
// This method checks if localStorage is usable in Safari Private Browsing
// mode, or in any other case where the available quota for localStorage
// is 0 and there wasn't any saved items yet.
function _isLocalStorageUsable() {
    return !checkIfLocalStorageThrows() || localStorage.length > 0;
}

// Config the localStorage backend, using options set in the config.
function _initStorage$2(options) {
    var self = this;
    var dbInfo = {};
    if (options) {
        for (var i in options) {
            dbInfo[i] = options[i];
        }
    }

    dbInfo.keyPrefix = _getKeyPrefix(options, self._defaultConfig);

    if (!_isLocalStorageUsable()) {
        return Promise$1.reject();
    }

    self._dbInfo = dbInfo;
    dbInfo.serializer = localforageSerializer;

    return Promise$1.resolve();
}

// Remove all keys from the datastore, effectively destroying all data in
// the app's key/value store!
function clear$2(callback) {
    var self = this;
    var promise = self.ready().then(function () {
        var keyPrefix = self._dbInfo.keyPrefix;

        for (var i = localStorage.length - 1; i >= 0; i--) {
            var key = localStorage.key(i);

            if (key.indexOf(keyPrefix) === 0) {
                localStorage.removeItem(key);
            }
        }
    });

    executeCallback(promise, callback);
    return promise;
}

// Retrieve an item from the store. Unlike the original async_storage
// library in Gaia, we don't modify return values at all. If a key's value
// is `undefined`, we pass that value to the callback function.
function getItem$2(key, callback) {
    var self = this;

    key = normalizeKey(key);

    var promise = self.ready().then(function () {
        var dbInfo = self._dbInfo;
        var result = localStorage.getItem(dbInfo.keyPrefix + key);

        // If a result was found, parse it from the serialized
        // string into a JS object. If result isn't truthy, the key
        // is likely undefined and we'll pass it straight to the
        // callback.
        if (result) {
            result = dbInfo.serializer.deserialize(result);
        }

        return result;
    });

    executeCallback(promise, callback);
    return promise;
}

// Iterate over all items in the store.
function iterate$2(iterator, callback) {
    var self = this;

    var promise = self.ready().then(function () {
        var dbInfo = self._dbInfo;
        var keyPrefix = dbInfo.keyPrefix;
        var keyPrefixLength = keyPrefix.length;
        var length = localStorage.length;

        // We use a dedicated iterator instead of the `i` variable below
        // so other keys we fetch in localStorage aren't counted in
        // the `iterationNumber` argument passed to the `iterate()`
        // callback.
        //
        // See: github.com/mozilla/localForage/pull/435#discussion_r38061530
        var iterationNumber = 1;

        for (var i = 0; i < length; i++) {
            var key = localStorage.key(i);
            if (key.indexOf(keyPrefix) !== 0) {
                continue;
            }
            var value = localStorage.getItem(key);

            // If a result was found, parse it from the serialized
            // string into a JS object. If result isn't truthy, the
            // key is likely undefined and we'll pass it straight
            // to the iterator.
            if (value) {
                value = dbInfo.serializer.deserialize(value);
            }

            value = iterator(value, key.substring(keyPrefixLength), iterationNumber++);

            if (value !== void 0) {
                return value;
            }
        }
    });

    executeCallback(promise, callback);
    return promise;
}

// Same as localStorage's key() method, except takes a callback.
function key$2(n, callback) {
    var self = this;
    var promise = self.ready().then(function () {
        var dbInfo = self._dbInfo;
        var result;
        try {
            result = localStorage.key(n);
        } catch (error) {
            result = null;
        }

        // Remove the prefix from the key, if a key is found.
        if (result) {
            result = result.substring(dbInfo.keyPrefix.length);
        }

        return result;
    });

    executeCallback(promise, callback);
    return promise;
}

function keys$2(callback) {
    var self = this;
    var promise = self.ready().then(function () {
        var dbInfo = self._dbInfo;
        var length = localStorage.length;
        var keys = [];

        for (var i = 0; i < length; i++) {
            var itemKey = localStorage.key(i);
            if (itemKey.indexOf(dbInfo.keyPrefix) === 0) {
                keys.push(itemKey.substring(dbInfo.keyPrefix.length));
            }
        }

        return keys;
    });

    executeCallback(promise, callback);
    return promise;
}

// Supply the number of keys in the datastore to the callback function.
function length$2(callback) {
    var self = this;
    var promise = self.keys().then(function (keys) {
        return keys.length;
    });

    executeCallback(promise, callback);
    return promise;
}

// Remove an item from the store, nice and simple.
function removeItem$2(key, callback) {
    var self = this;

    key = normalizeKey(key);

    var promise = self.ready().then(function () {
        var dbInfo = self._dbInfo;
        localStorage.removeItem(dbInfo.keyPrefix + key);
    });

    executeCallback(promise, callback);
    return promise;
}

// Set a key's value and run an optional callback once the value is set.
// Unlike Gaia's implementation, the callback function is passed the value,
// in case you want to operate on that value only after you're sure it
// saved, or something like that.
function setItem$2(key, value, callback) {
    var self = this;

    key = normalizeKey(key);

    var promise = self.ready().then(function () {
        // Convert undefined values to null.
        // https://github.com/mozilla/localForage/pull/42
        if (value === undefined) {
            value = null;
        }

        // Save the original value to pass to the callback.
        var originalValue = value;

        return new Promise$1(function (resolve, reject) {
            var dbInfo = self._dbInfo;
            dbInfo.serializer.serialize(value, function (value, error) {
                if (error) {
                    reject(error);
                } else {
                    try {
                        localStorage.setItem(dbInfo.keyPrefix + key, value);
                        resolve(originalValue);
                    } catch (e) {
                        // localStorage capacity exceeded.
                        // TODO: Make this a specific error/event.
                        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                            reject(e);
                        }
                        reject(e);
                    }
                }
            });
        });
    });

    executeCallback(promise, callback);
    return promise;
}

function dropInstance$2(options, callback) {
    callback = getCallback.apply(this, arguments);

    options = typeof options !== 'function' && options || {};
    if (!options.name) {
        var currentConfig = this.config();
        options.name = options.name || currentConfig.name;
        options.storeName = options.storeName || currentConfig.storeName;
    }

    var self = this;
    var promise;
    if (!options.name) {
        promise = Promise$1.reject('Invalid arguments');
    } else {
        promise = new Promise$1(function (resolve) {
            if (!options.storeName) {
                resolve(options.name + '/');
            } else {
                resolve(_getKeyPrefix(options, self._defaultConfig));
            }
        }).then(function (keyPrefix) {
            for (var i = localStorage.length - 1; i >= 0; i--) {
                var key = localStorage.key(i);

                if (key.indexOf(keyPrefix) === 0) {
                    localStorage.removeItem(key);
                }
            }
        });
    }

    executeCallback(promise, callback);
    return promise;
}

var localStorageWrapper = {
    _driver: 'localStorageWrapper',
    _initStorage: _initStorage$2,
    _support: isLocalStorageValid(),
    iterate: iterate$2,
    getItem: getItem$2,
    setItem: setItem$2,
    removeItem: removeItem$2,
    clear: clear$2,
    length: length$2,
    key: key$2,
    keys: keys$2,
    dropInstance: dropInstance$2
};

var sameValue = function sameValue(x, y) {
    return x === y || typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y);
};

var includes = function includes(array, searchElement) {
    var len = array.length;
    var i = 0;
    while (i < len) {
        if (sameValue(array[i], searchElement)) {
            return true;
        }
        i++;
    }

    return false;
};

var isArray = Array.isArray || function (arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
};

// Drivers are stored here when `defineDriver()` is called.
// They are shared across all instances of localForage.
var DefinedDrivers = {};

var DriverSupport = {};

var DefaultDrivers = {
    INDEXEDDB: asyncStorage,
    WEBSQL: webSQLStorage,
    LOCALSTORAGE: localStorageWrapper
};

var DefaultDriverOrder = [DefaultDrivers.INDEXEDDB._driver, DefaultDrivers.WEBSQL._driver, DefaultDrivers.LOCALSTORAGE._driver];

var OptionalDriverMethods = ['dropInstance'];

var LibraryMethods = ['clear', 'getItem', 'iterate', 'key', 'keys', 'length', 'removeItem', 'setItem'].concat(OptionalDriverMethods);

var DefaultConfig = {
    description: '',
    driver: DefaultDriverOrder.slice(),
    name: 'localforage',
    // Default DB size is _JUST UNDER_ 5MB, as it's the highest size
    // we can use without a prompt.
    size: 4980736,
    storeName: 'keyvaluepairs',
    version: 1.0
};

function callWhenReady(localForageInstance, libraryMethod) {
    localForageInstance[libraryMethod] = function () {
        var _args = arguments;
        return localForageInstance.ready().then(function () {
            return localForageInstance[libraryMethod].apply(localForageInstance, _args);
        });
    };
}

function extend() {
    for (var i = 1; i < arguments.length; i++) {
        var arg = arguments[i];

        if (arg) {
            for (var _key in arg) {
                if (arg.hasOwnProperty(_key)) {
                    if (isArray(arg[_key])) {
                        arguments[0][_key] = arg[_key].slice();
                    } else {
                        arguments[0][_key] = arg[_key];
                    }
                }
            }
        }
    }

    return arguments[0];
}

var LocalForage = function () {
    function LocalForage(options) {
        _classCallCheck(this, LocalForage);

        for (var driverTypeKey in DefaultDrivers) {
            if (DefaultDrivers.hasOwnProperty(driverTypeKey)) {
                var driver = DefaultDrivers[driverTypeKey];
                var driverName = driver._driver;
                this[driverTypeKey] = driverName;

                if (!DefinedDrivers[driverName]) {
                    // we don't need to wait for the promise,
                    // since the default drivers can be defined
                    // in a blocking manner
                    this.defineDriver(driver);
                }
            }
        }

        this._defaultConfig = extend({}, DefaultConfig);
        this._config = extend({}, this._defaultConfig, options);
        this._driverSet = null;
        this._initDriver = null;
        this._ready = false;
        this._dbInfo = null;

        this._wrapLibraryMethodsWithReady();
        this.setDriver(this._config.driver)["catch"](function () {});
    }

    // Set any config values for localForage; can be called anytime before
    // the first API call (e.g. `getItem`, `setItem`).
    // We loop through options so we don't overwrite existing config
    // values.


    LocalForage.prototype.config = function config(options) {
        // If the options argument is an object, we use it to set values.
        // Otherwise, we return either a specified config value or all
        // config values.
        if ((typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object') {
            // If localforage is ready and fully initialized, we can't set
            // any new configuration values. Instead, we return an error.
            if (this._ready) {
                return new Error("Can't call config() after localforage " + 'has been used.');
            }

            for (var i in options) {
                if (i === 'storeName') {
                    options[i] = options[i].replace(/\W/g, '_');
                }

                if (i === 'version' && typeof options[i] !== 'number') {
                    return new Error('Database version must be a number.');
                }

                this._config[i] = options[i];
            }

            // after all config options are set and
            // the driver option is used, try setting it
            if ('driver' in options && options.driver) {
                return this.setDriver(this._config.driver);
            }

            return true;
        } else if (typeof options === 'string') {
            return this._config[options];
        } else {
            return this._config;
        }
    };

    // Used to define a custom driver, shared across all instances of
    // localForage.


    LocalForage.prototype.defineDriver = function defineDriver(driverObject, callback, errorCallback) {
        var promise = new Promise$1(function (resolve, reject) {
            try {
                var driverName = driverObject._driver;
                var complianceError = new Error('Custom driver not compliant; see ' + 'https://mozilla.github.io/localForage/#definedriver');

                // A driver name should be defined and not overlap with the
                // library-defined, default drivers.
                if (!driverObject._driver) {
                    reject(complianceError);
                    return;
                }

                var driverMethods = LibraryMethods.concat('_initStorage');
                for (var i = 0, len = driverMethods.length; i < len; i++) {
                    var driverMethodName = driverMethods[i];

                    // when the property is there,
                    // it should be a method even when optional
                    var isRequired = !includes(OptionalDriverMethods, driverMethodName);
                    if ((isRequired || driverObject[driverMethodName]) && typeof driverObject[driverMethodName] !== 'function') {
                        reject(complianceError);
                        return;
                    }
                }

                var configureMissingMethods = function configureMissingMethods() {
                    var methodNotImplementedFactory = function methodNotImplementedFactory(methodName) {
                        return function () {
                            var error = new Error('Method ' + methodName + ' is not implemented by the current driver');
                            var promise = Promise$1.reject(error);
                            executeCallback(promise, arguments[arguments.length - 1]);
                            return promise;
                        };
                    };

                    for (var _i = 0, _len = OptionalDriverMethods.length; _i < _len; _i++) {
                        var optionalDriverMethod = OptionalDriverMethods[_i];
                        if (!driverObject[optionalDriverMethod]) {
                            driverObject[optionalDriverMethod] = methodNotImplementedFactory(optionalDriverMethod);
                        }
                    }
                };

                configureMissingMethods();

                var setDriverSupport = function setDriverSupport(support) {
                    if (DefinedDrivers[driverName]) {
                        console.info('Redefining LocalForage driver: ' + driverName);
                    }
                    DefinedDrivers[driverName] = driverObject;
                    DriverSupport[driverName] = support;
                    // don't use a then, so that we can define
                    // drivers that have simple _support methods
                    // in a blocking manner
                    resolve();
                };

                if ('_support' in driverObject) {
                    if (driverObject._support && typeof driverObject._support === 'function') {
                        driverObject._support().then(setDriverSupport, reject);
                    } else {
                        setDriverSupport(!!driverObject._support);
                    }
                } else {
                    setDriverSupport(true);
                }
            } catch (e) {
                reject(e);
            }
        });

        executeTwoCallbacks(promise, callback, errorCallback);
        return promise;
    };

    LocalForage.prototype.driver = function driver() {
        return this._driver || null;
    };

    LocalForage.prototype.getDriver = function getDriver(driverName, callback, errorCallback) {
        var getDriverPromise = DefinedDrivers[driverName] ? Promise$1.resolve(DefinedDrivers[driverName]) : Promise$1.reject(new Error('Driver not found.'));

        executeTwoCallbacks(getDriverPromise, callback, errorCallback);
        return getDriverPromise;
    };

    LocalForage.prototype.getSerializer = function getSerializer(callback) {
        var serializerPromise = Promise$1.resolve(localforageSerializer);
        executeTwoCallbacks(serializerPromise, callback);
        return serializerPromise;
    };

    LocalForage.prototype.ready = function ready(callback) {
        var self = this;

        var promise = self._driverSet.then(function () {
            if (self._ready === null) {
                self._ready = self._initDriver();
            }

            return self._ready;
        });

        executeTwoCallbacks(promise, callback, callback);
        return promise;
    };

    LocalForage.prototype.setDriver = function setDriver(drivers, callback, errorCallback) {
        var self = this;

        if (!isArray(drivers)) {
            drivers = [drivers];
        }

        var supportedDrivers = this._getSupportedDrivers(drivers);

        function setDriverToConfig() {
            self._config.driver = self.driver();
        }

        function extendSelfWithDriver(driver) {
            self._extend(driver);
            setDriverToConfig();

            self._ready = self._initStorage(self._config);
            return self._ready;
        }

        function initDriver(supportedDrivers) {
            return function () {
                var currentDriverIndex = 0;

                function driverPromiseLoop() {
                    while (currentDriverIndex < supportedDrivers.length) {
                        var driverName = supportedDrivers[currentDriverIndex];
                        currentDriverIndex++;

                        self._dbInfo = null;
                        self._ready = null;

                        return self.getDriver(driverName).then(extendSelfWithDriver)["catch"](driverPromiseLoop);
                    }

                    setDriverToConfig();
                    var error = new Error('No available storage method found.');
                    self._driverSet = Promise$1.reject(error);
                    return self._driverSet;
                }

                return driverPromiseLoop();
            };
        }

        // There might be a driver initialization in progress
        // so wait for it to finish in order to avoid a possible
        // race condition to set _dbInfo
        var oldDriverSetDone = this._driverSet !== null ? this._driverSet["catch"](function () {
            return Promise$1.resolve();
        }) : Promise$1.resolve();

        this._driverSet = oldDriverSetDone.then(function () {
            var driverName = supportedDrivers[0];
            self._dbInfo = null;
            self._ready = null;

            return self.getDriver(driverName).then(function (driver) {
                self._driver = driver._driver;
                setDriverToConfig();
                self._wrapLibraryMethodsWithReady();
                self._initDriver = initDriver(supportedDrivers);
            });
        })["catch"](function () {
            setDriverToConfig();
            var error = new Error('No available storage method found.');
            self._driverSet = Promise$1.reject(error);
            return self._driverSet;
        });

        executeTwoCallbacks(this._driverSet, callback, errorCallback);
        return this._driverSet;
    };

    LocalForage.prototype.supports = function supports(driverName) {
        return !!DriverSupport[driverName];
    };

    LocalForage.prototype._extend = function _extend(libraryMethodsAndProperties) {
        extend(this, libraryMethodsAndProperties);
    };

    LocalForage.prototype._getSupportedDrivers = function _getSupportedDrivers(drivers) {
        var supportedDrivers = [];
        for (var i = 0, len = drivers.length; i < len; i++) {
            var driverName = drivers[i];
            if (this.supports(driverName)) {
                supportedDrivers.push(driverName);
            }
        }
        return supportedDrivers;
    };

    LocalForage.prototype._wrapLibraryMethodsWithReady = function _wrapLibraryMethodsWithReady() {
        // Add a stub for each driver API method that delays the call to the
        // corresponding driver method until localForage is ready. These stubs
        // will be replaced by the driver methods as soon as the driver is
        // loaded, so there is no performance impact.
        for (var i = 0, len = LibraryMethods.length; i < len; i++) {
            callWhenReady(this, LibraryMethods[i]);
        }
    };

    LocalForage.prototype.createInstance = function createInstance(options) {
        return new LocalForage(options);
    };

    return LocalForage;
}();

// The actual localForage object that we expose as a module or via a
// global. It's extended by pulling in one of our other libraries.


var localforage_js = new LocalForage();

module.exports = localforage_js;

},{"3":3}]},{},[4])(4)
});


/***/ }),

/***/ 4218:
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_RESULT__;/**
 * A doubly linked list-based Least Recently Used (LRU) cache. Will keep most
 * recently used items while discarding least recently used items when its limit
 * is reached.
 *
 * Licensed under MIT. Copyright (c) 2010 Rasmus Andersson <http://hunch.se/>
 * See README.md for details.
 *
 * Illustration of the design:
 *
 *       entry             entry             entry             entry
 *       ______            ______            ______            ______
 *      | head |.newer => |      |.newer => |      |.newer => | tail |
 *      |  A   |          |  B   |          |  C   |          |  D   |
 *      |______| <= older.|______| <= older.|______| <= older.|______|
 *
 *  removed  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  added
 */
(function(g,f){
  const e =  true ? exports : 0;
  f(e);
  if (true) { !(__WEBPACK_AMD_DEFINE_FACTORY__ = (e),
		__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
		(__WEBPACK_AMD_DEFINE_FACTORY__.call(exports, __webpack_require__, exports, module)) :
		__WEBPACK_AMD_DEFINE_FACTORY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)); }
})(this, function(exports) {

const NEWER = Symbol('newer');
const OLDER = Symbol('older');

function LRUMap(limit, entries) {
  if (typeof limit !== 'number') {
    // called as (entries)
    entries = limit;
    limit = 0;
  }

  this.size = 0;
  this.limit = limit;
  this.oldest = this.newest = undefined;
  this._keymap = new Map();

  if (entries) {
    this.assign(entries);
    if (limit < 1) {
      this.limit = this.size;
    }
  }
}

exports.LRUMap = LRUMap;

function Entry(key, value) {
  this.key = key;
  this.value = value;
  this[NEWER] = undefined;
  this[OLDER] = undefined;
}


LRUMap.prototype._markEntryAsUsed = function(entry) {
  if (entry === this.newest) {
    // Already the most recenlty used entry, so no need to update the list
    return;
  }
  // HEAD--------------TAIL
  //   <.older   .newer>
  //  <--- add direction --
  //   A  B  C  <D>  E
  if (entry[NEWER]) {
    if (entry === this.oldest) {
      this.oldest = entry[NEWER];
    }
    entry[NEWER][OLDER] = entry[OLDER]; // C <-- E.
  }
  if (entry[OLDER]) {
    entry[OLDER][NEWER] = entry[NEWER]; // C. --> E
  }
  entry[NEWER] = undefined; // D --x
  entry[OLDER] = this.newest; // D. --> E
  if (this.newest) {
    this.newest[NEWER] = entry; // E. <-- D
  }
  this.newest = entry;
};

LRUMap.prototype.assign = function(entries) {
  let entry, limit = this.limit || Number.MAX_VALUE;
  this._keymap.clear();
  let it = entries[Symbol.iterator]();
  for (let itv = it.next(); !itv.done; itv = it.next()) {
    let e = new Entry(itv.value[0], itv.value[1]);
    this._keymap.set(e.key, e);
    if (!entry) {
      this.oldest = e;
    } else {
      entry[NEWER] = e;
      e[OLDER] = entry;
    }
    entry = e;
    if (limit-- == 0) {
      throw new Error('overflow');
    }
  }
  this.newest = entry;
  this.size = this._keymap.size;
};

LRUMap.prototype.get = function(key) {
  // First, find our cache entry
  var entry = this._keymap.get(key);
  if (!entry) return; // Not cached. Sorry.
  // As <key> was found in the cache, register it as being requested recently
  this._markEntryAsUsed(entry);
  return entry.value;
};

LRUMap.prototype.set = function(key, value) {
  var entry = this._keymap.get(key);

  if (entry) {
    // update existing
    entry.value = value;
    this._markEntryAsUsed(entry);
    return this;
  }

  // new entry
  this._keymap.set(key, (entry = new Entry(key, value)));

  if (this.newest) {
    // link previous tail to the new tail (entry)
    this.newest[NEWER] = entry;
    entry[OLDER] = this.newest;
  } else {
    // we're first in -- yay
    this.oldest = entry;
  }

  // add new entry to the end of the linked list -- it's now the freshest entry.
  this.newest = entry;
  ++this.size;
  if (this.size > this.limit) {
    // we hit the limit -- remove the head
    this.shift();
  }

  return this;
};

LRUMap.prototype.shift = function() {
  // todo: handle special case when limit == 1
  var entry = this.oldest;
  if (entry) {
    if (this.oldest[NEWER]) {
      // advance the list
      this.oldest = this.oldest[NEWER];
      this.oldest[OLDER] = undefined;
    } else {
      // the cache is exhausted
      this.oldest = undefined;
      this.newest = undefined;
    }
    // Remove last strong reference to <entry> and remove links from the purged
    // entry being returned:
    entry[NEWER] = entry[OLDER] = undefined;
    this._keymap.delete(entry.key);
    --this.size;
    return [entry.key, entry.value];
  }
};

// ----------------------------------------------------------------------------
// Following code is optional and can be removed without breaking the core
// functionality.

LRUMap.prototype.find = function(key) {
  let e = this._keymap.get(key);
  return e ? e.value : undefined;
};

LRUMap.prototype.has = function(key) {
  return this._keymap.has(key);
};

LRUMap.prototype['delete'] = function(key) {
  var entry = this._keymap.get(key);
  if (!entry) return;
  this._keymap.delete(entry.key);
  if (entry[NEWER] && entry[OLDER]) {
    // relink the older entry with the newer entry
    entry[OLDER][NEWER] = entry[NEWER];
    entry[NEWER][OLDER] = entry[OLDER];
  } else if (entry[NEWER]) {
    // remove the link to us
    entry[NEWER][OLDER] = undefined;
    // link the newer entry to head
    this.oldest = entry[NEWER];
  } else if (entry[OLDER]) {
    // remove the link to us
    entry[OLDER][NEWER] = undefined;
    // link the newer entry to head
    this.newest = entry[OLDER];
  } else {// if(entry[OLDER] === undefined && entry.newer === undefined) {
    this.oldest = this.newest = undefined;
  }

  this.size--;
  return entry.value;
};

LRUMap.prototype.clear = function() {
  // Not clearing links should be safe, as we don't expose live links to user
  this.oldest = this.newest = undefined;
  this.size = 0;
  this._keymap.clear();
};


function EntryIterator(oldestEntry) { this.entry = oldestEntry; }
EntryIterator.prototype[Symbol.iterator] = function() { return this; }
EntryIterator.prototype.next = function() {
  let ent = this.entry;
  if (ent) {
    this.entry = ent[NEWER];
    return { done: false, value: [ent.key, ent.value] };
  } else {
    return { done: true, value: undefined };
  }
};


function KeyIterator(oldestEntry) { this.entry = oldestEntry; }
KeyIterator.prototype[Symbol.iterator] = function() { return this; }
KeyIterator.prototype.next = function() {
  let ent = this.entry;
  if (ent) {
    this.entry = ent[NEWER];
    return { done: false, value: ent.key };
  } else {
    return { done: true, value: undefined };
  }
};

function ValueIterator(oldestEntry) { this.entry = oldestEntry; }
ValueIterator.prototype[Symbol.iterator] = function() { return this; }
ValueIterator.prototype.next = function() {
  let ent = this.entry;
  if (ent) {
    this.entry = ent[NEWER];
    return { done: false, value: ent.value };
  } else {
    return { done: true, value: undefined };
  }
};


LRUMap.prototype.keys = function() {
  return new KeyIterator(this.oldest);
};

LRUMap.prototype.values = function() {
  return new ValueIterator(this.oldest);
};

LRUMap.prototype.entries = function() {
  return this;
};

LRUMap.prototype[Symbol.iterator] = function() {
  return new EntryIterator(this.oldest);
};

LRUMap.prototype.forEach = function(fun, thisObj) {
  if (typeof thisObj !== 'object') {
    thisObj = this;
  }
  let entry = this.oldest;
  while (entry) {
    fun.call(thisObj, entry.value, entry.key, this);
    entry = entry[NEWER];
  }
};

/** Returns a JSON (array) representation */
LRUMap.prototype.toJSON = function() {
  var s = new Array(this.size), i = 0, entry = this.oldest;
  while (entry) {
    s[i++] = { key: entry.key, value: entry.value };
    entry = entry[NEWER];
  }
  return s;
};

/** Returns a String representation */
LRUMap.prototype.toString = function() {
  var s = '', entry = this.oldest;
  while (entry) {
    s += String(entry.key)+':'+entry.value;
    entry = entry[NEWER];
    if (entry) {
      s += ' < ';
    }
  }
  return s;
};

});


/***/ }),

/***/ 6338:
/***/ ((module) => {

/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isFinite(val)) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'weeks':
    case 'week':
    case 'w':
      return n * w;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (msAbs >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (msAbs >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (msAbs >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return plural(ms, msAbs, d, 'day');
  }
  if (msAbs >= h) {
    return plural(ms, msAbs, h, 'hour');
  }
  if (msAbs >= m) {
    return plural(ms, msAbs, m, 'minute');
  }
  if (msAbs >= s) {
    return plural(ms, msAbs, s, 'second');
  }
  return ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, msAbs, n, name) {
  var isPlural = msAbs >= n * 1.5;
  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}


/***/ }),

/***/ 7527:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__(6724)


/***/ }),

/***/ 2195:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

const os = __webpack_require__(2037);
const tty = __webpack_require__(6224);
const hasFlag = __webpack_require__(635);

const {env} = process;

let forceColor;
if (hasFlag('no-color') ||
	hasFlag('no-colors') ||
	hasFlag('color=false') ||
	hasFlag('color=never')) {
	forceColor = 0;
} else if (hasFlag('color') ||
	hasFlag('colors') ||
	hasFlag('color=true') ||
	hasFlag('color=always')) {
	forceColor = 1;
}

if ('FORCE_COLOR' in env) {
	if (env.FORCE_COLOR === 'true') {
		forceColor = 1;
	} else if (env.FORCE_COLOR === 'false') {
		forceColor = 0;
	} else {
		forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
	}
}

function translateLevel(level) {
	if (level === 0) {
		return false;
	}

	return {
		level,
		hasBasic: true,
		has256: level >= 2,
		has16m: level >= 3
	};
}

function supportsColor(haveStream, streamIsTTY) {
	if (forceColor === 0) {
		return 0;
	}

	if (hasFlag('color=16m') ||
		hasFlag('color=full') ||
		hasFlag('color=truecolor')) {
		return 3;
	}

	if (hasFlag('color=256')) {
		return 2;
	}

	if (haveStream && !streamIsTTY && forceColor === undefined) {
		return 0;
	}

	const min = forceColor || 0;

	if (env.TERM === 'dumb') {
		return min;
	}

	if (process.platform === 'win32') {
		// Windows 10 build 10586 is the first Windows release that supports 256 colors.
		// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
		const osRelease = os.release().split('.');
		if (
			Number(osRelease[0]) >= 10 &&
			Number(osRelease[2]) >= 10586
		) {
			return Number(osRelease[2]) >= 14931 ? 3 : 2;
		}

		return 1;
	}

	if ('CI' in env) {
		if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'GITHUB_ACTIONS', 'BUILDKITE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
			return 1;
		}

		return min;
	}

	if ('TEAMCITY_VERSION' in env) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
	}

	if (env.COLORTERM === 'truecolor') {
		return 3;
	}

	if ('TERM_PROGRAM' in env) {
		const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

		switch (env.TERM_PROGRAM) {
			case 'iTerm.app':
				return version >= 3 ? 3 : 2;
			case 'Apple_Terminal':
				return 2;
			// No default
		}
	}

	if (/-256(color)?$/i.test(env.TERM)) {
		return 2;
	}

	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
		return 1;
	}

	if ('COLORTERM' in env) {
		return 1;
	}

	return min;
}

function getSupportLevel(stream) {
	const level = supportsColor(stream, stream && stream.isTTY);
	return translateLevel(level);
}

module.exports = {
	supportsColor: getSupportLevel,
	stdout: translateLevel(supportsColor(true, tty.isatty(1))),
	stderr: translateLevel(supportsColor(true, tty.isatty(2)))
};


/***/ })

};
;
//# sourceMappingURL=1.js.map