/*!
 * Base64AudioPlayer  v1
 * Copyright 2024-2025 Eldiiar Bekbolotov
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
 */
/**
 * @constructor
 * @param {string[]} audioArray - Array of Base64 encoded audio strings.
 * @param {Object} [options] - Optional configuration options.
 * @param {string} [options.loopMode='none'] - Loop mode: "none", "track", or "collection".
 * @param {function(number, number):void} [options.onTimeUpdate] - Callback invoked on time updates (currentTime, duration).
 * @param {function(number, number):void} [options.onTrackLoad] - Callback invoked when a track is loaded (index, duration).
 * @param {function(number):void} [options.onTrackEnd] - Callback invoked when a track ends (index).
 */
function Base64AudioPlayer(audioArray, options) {
    options = options || {};
    if (!window.AudioContext && !window.webkitAudioContext) {
      throw new Error("Web Audio API is not supported in this browser.");
    }
    /**
     * @type {string[]}
     * @description Array of Base64 encoded audio strings.
     */
    this.audioArray = audioArray || [];
    /**
     * @type {number}
     * @description The current track index.
     */
    this.currentIndex = 0;
    /**
     * @type {AudioContext}
     * @description Audio context used for playback.
     */
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    /**
     * @type {AnalyserNode}
     * @description Analyser node for audio analysis.
     */
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    /**
     * @type {?AudioBufferSourceNode}
     * @description The current audio source node.
     */
    this.source = null;
    /**
     * @type {?AudioBuffer}
     * @description The current audio buffer.
     */
    this.buffer = null;
    /**
     * @type {boolean}
     * @description Indicates whether audio is currently playing.
     */
    this.isPlaying = false;
    /**
     * @type {boolean}
     * @description Indicates whether audio is paused.
     */
    this.isPaused = false;
    /**
     * @type {number}
     * @description The start time of the current playback.
     */
    this.startTime = 0;
    /**
     * @type {number}
     * @description The elapsed time of the current track.
     */
    this.elapsedTime = 0;
    /**
     * @type {number}
     * @description The duration of the current track.
     */
    this.duration = 0;
    /**
     * @type {string}
     * @description The loop mode: "none", "track", or "collection".
     */
    this.loopMode = options.loopMode || 'none';
    /**
     * @type {function(number, number):void|null}
     * @description Callback for time updates.
     */
    this.onTimeUpdate = options.onTimeUpdate || null;
    /**
     * @type {function(number, number):void|null}
     * @description Callback when a track is loaded.
     */
    this.onTrackLoad = options.onTrackLoad || null;
    /**
     * @type {function(number):void|null}
     * @description Callback when a track ends.
     */
    this.onTrackEnd = options.onTrackEnd || null;
  
    // Load the first track.
    this.loadAudio(this.currentIndex);
  }
  
  /**
   * Converts a Base64 string to an ArrayBuffer.
   *
   * @private
   * @param {string} base64Str - The Base64 encoded string.
   * @returns {ArrayBuffer} The resulting ArrayBuffer.
   */
  Base64AudioPlayer.prototype._convertBase64ToArrayBuffer = function(base64Str) {
    var parts = base64Str.split(",");
    var base64Content = parts[1] ? parts[1] : base64Str;
    var binaryString = atob(base64Content);
    var len = binaryString.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };
  
  /**
   * Loads the audio track at the specified index.
   *
   * @param {number} index - The index of the track to load.
   */
  Base64AudioPlayer.prototype.loadAudio = function(index) {
    if (index < 0 || index >= this.audioArray.length) {
      console.error("Index out of bounds");
      return;
    }
    var self = this;
    var arrayBuffer = this._convertBase64ToArrayBuffer(this.audioArray[index]);
    this.audioContext.decodeAudioData(
      arrayBuffer,
      function(decodedData) {
        self.buffer = decodedData;
        self.duration = decodedData.duration;
        self.elapsedTime = 0;
        if (typeof self.onTrackLoad === "function") {
          self.onTrackLoad(index, self.duration);
        }
      },
      function(error) {
        console.error("Error decoding audio data:", error);
      }
    );
  };
  
  /**
   * Starts playback of currently loaded track.
   */
  Base64AudioPlayer.prototype.play = function() {
    var self = this;
    if (!this.buffer) {
      console.warn("Audio not loaded yet.");
      return;
    }
    if (this.isPlaying) return;
  
    this.source = this.audioContext.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  
    var offset = this.elapsedTime;
    this.startTime = this.audioContext.currentTime - offset;
    this.source.start(0, offset);
    this.isPlaying = true;
    this.isPaused = false;
  
    this.source.onended = function() {
      if (self.isPaused) return;
      if (self.loopMode === "track") {
        self.restartTrack();
      } else {
        self.isPlaying = false;
        self.elapsedTime = 0;
        if (typeof self.onTrackEnd === "function") {
          self.onTrackEnd(self.currentIndex);
        }
        if (self.loopMode === "collection") {
          self.nextTrack(true);
        }
      }
    };
  
    if (typeof this.onTimeUpdate === "function") {
      this._startTimeUpdateLoop();
    }
  };
  
  /**
   * Restarts current track from the beginning.
   */
  Base64AudioPlayer.prototype.restartTrack = function() {
    this.stop();
    this.elapsedTime = 0;
    this.play();
  };
  
  /**
   * Pauses playback.
   */
  Base64AudioPlayer.prototype.pause = function() {
    if (this.isPlaying) {
      this.source.stop();
      this.elapsedTime = this.audioContext.currentTime - this.startTime;
      this.isPlaying = false;
      this.isPaused = true;
    }
  };
  
  /**
   * Toggles between play / pause states.
   */
  Base64AudioPlayer.prototype.togglePlayPause = function() {
    if (this.isPlaying) {
      this.pause();
    } else {
      if (this.elapsedTime >= this.duration) {
        this.elapsedTime = 0;
      }
      this.play();
    }
  };
  
  /**
   * Stops playback.
   */
  Base64AudioPlayer.prototype.stop = function() {
    if (this.isPlaying) {
      this.source.stop();
      this.isPlaying = false;
      this.isPaused = false;
    }
  };
  
  /**
   * Advances to next track.
   *
   * @param {boolean} [auto=false] - Whether track change was triggered automatically.
   */
  Base64AudioPlayer.prototype.nextTrack = function(auto) {
    auto = auto || false;
    if (this.currentIndex < this.audioArray.length - 1) {
      this.currentIndex++;
    } else if (this.loopMode === "collection") {
      this.currentIndex = 0;
    } else {
      if (!auto) console.warn("No more tracks available.");
      return;
    }
    this.loadAudio(this.currentIndex);
    this.elapsedTime = 0;
    if (this.isPlaying || auto) {
      this.play();
    }
  };
  
  /**
   * Moves to previous track.
   */
  Base64AudioPlayer.prototype.prevTrack = function() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.loadAudio(this.currentIndex);
      this.elapsedTime = 0;
      if (this.isPlaying) {
        this.play();
      }
    } else {
      console.warn("This is the first track.");
    }
  };
  
  /**
   * Sets the loop mode.
   *
   * @param {string} mode - Loop mode ("none", "track", or "collection").
   */
  Base64AudioPlayer.prototype.setLoopMode = function(mode) {
    if (mode === "none" || mode === "track" || mode === "collection") {
      this.loopMode = mode;
    } else {
      console.error("Invalid loop mode. Use 'none', 'track', or 'collection'.");
    }
  };
  
  /**
   * Returns current playback time in seconds.
   *
   * @returns {number} Current playback time.
   */
  Base64AudioPlayer.prototype.getCurrentTime = function() {
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    }
    return this.elapsedTime;
  };
  
  /**
   * Returns duration of the current track in seconds.
   *
   * @returns {number} Duration of the track.
   */
  Base64AudioPlayer.prototype.getDuration = function() {
    return this.duration;
  };
  
  /**
   * Returns current track index.
   *
   * @returns {number} Current track index.
   */
  Base64AudioPlayer.prototype.getCurrentTrackIndex = function() {
    return this.currentIndex;
  };
  
  /**
   * Returns total number of tracks.
   *
   * @returns {number}Total track count.
   */
  Base64AudioPlayer.prototype.getTrackCount = function() {
    return this.audioArray.length;
  };
  
  /**
   * Starts the update loop to trigger the onTimeUpdate callback.
   *
   * @private
   */
  Base64AudioPlayer.prototype._startTimeUpdateLoop = function() {
    var self = this;
    (function update() {
      if (self.isPlaying) {
        var currentTime = self.getCurrentTime();
        if (typeof self.onTimeUpdate === "function") {
          self.onTimeUpdate(currentTime, self.duration);
        }
        requestAnimationFrame(update);
      }
    })();
  };
  
  window.Base64AudioPlayer = Base64AudioPlayer;