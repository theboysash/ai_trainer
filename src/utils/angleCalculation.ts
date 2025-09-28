// src/utils/angleCalculation.ts - Enhanced angle calculation utilities
export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Calculate the angle between three points (a-b-c) where b is the vertex
 * @param a First point
 * @param b Vertex point (where angle is measured)
 * @param c Third point
 * @returns Angle in degrees
 */
export function calculateAngle(a: Point2D | Point3D, b: Point2D | Point3D, c: Point2D | Point3D): number {
  // Calculate vectors ba and bc
  const ba = [a.x - b.x, a.y - b.y];
  const bc = [c.x - b.x, c.y - b.y];

  // Calculate dot product
  const dotProduct = ba[0] * bc[0] + ba[1] * bc[1];

  // Calculate magnitudes
  const magnitudeBA = Math.sqrt(ba[0] ** 2 + ba[1] ** 2);
  const magnitudeBC = Math.sqrt(bc[0] ** 2 + bc[1] ** 2);

  // Avoid division by zero
  if (magnitudeBA === 0 || magnitudeBC === 0) {
    return 0;
  }

  // Calculate cosine of angle
  const cosineAngle = dotProduct / (magnitudeBA * magnitudeBC);

  // Clamp to valid range for acos
  const clampedCosine = Math.max(-1, Math.min(1, cosineAngle));

  // Calculate angle in radians then convert to degrees
  const angleRadians = Math.acos(clampedCosine);
  const angleDegrees = angleRadians * (180 / Math.PI);

  return angleDegrees;
}

/**
 * Calculate shoulder-elbow-hip angle for posture checking
 * @param shoulder Shoulder landmark
 * @param elbow Elbow landmark  
 * @param hip Hip landmark
 * @returns Angle in degrees
 */
export function calculateShoulderElbowHipAngle(
  shoulder: Point2D | Point3D, 
  elbow: Point2D | Point3D, 
  hip: Point2D | Point3D
): number {
  return calculateAngle(elbow, shoulder, hip);
}

/**
 * Calculate arm elevation angle from vertical (for lateral/front raises)
 * @param shoulder Shoulder landmark
 * @param elbow Elbow landmark
 * @returns Elevation angle in degrees (0 = arm down, 90 = arm horizontal)
 */
export function calculateArmElevationAngle(
  shoulder: Point2D | Point3D, 
  elbow: Point2D | Point3D
): number {
  const armVector = [elbow.x - shoulder.x, elbow.y - shoulder.y];
  
  // Gravity vector points down in screen coordinates (positive Y)
  const gravityVector = [0, 1];
  
  // Calculate angle between arm and gravity
  const dotProduct = armVector[0] * gravityVector[0] + armVector[1] * gravityVector[1];
  const armMagnitude = Math.sqrt(armVector[0] ** 2 + armVector[1] ** 2);
  
  if (armMagnitude === 0) return 0;
  
  let elevationAngle = Math.acos(Math.abs(dotProduct) / armMagnitude) * (180 / Math.PI);
  
  // Convert to lateral raise angle (0° = arm down, 90° = arm horizontal)
  if (armVector[1] < 0) {
    elevationAngle = 90 - elevationAngle;
  } else {
    elevationAngle = Math.max(0, 90 - elevationAngle);
  }
  
  return Math.max(0, Math.min(90, elevationAngle));
}

/**
 * Calculate horizontal distance for rowing exercises
 * @param shoulder Shoulder landmark
 * @param elbow Elbow landmark
 * @returns Angle representation of horizontal distance
 */
export function calculateRowingDistance(
  shoulder: Point2D | Point3D, 
  elbow: Point2D | Point3D
): number {
  const horizontalDistance = shoulder.x - elbow.x; // Positive when elbow is behind shoulder
  const angle = Math.max(0, Math.min(180, 90 + (horizontalDistance * 200))); // Convert to angle
  return angle;
}

/**
 * Check if landmarks are visible and valid
 * @param landmarks Array of landmarks to check
 * @param indices Indices of landmarks to validate
 * @param threshold Minimum visibility threshold
 * @returns True if all landmarks are visible
 */
export function areLandmarksVisible(
  landmarks: any[], 
  indices: number[], 
  threshold: number = 0.5
): boolean {
  return indices.every(idx => {
    const landmark = landmarks[idx];
    return landmark && (landmark.visibility ?? 1) > threshold;
  });
}

/**
 * Convert MediaPipe landmark to Point2D with frame dimensions
 * @param landmark MediaPipe landmark
 * @param frameWidth Video frame width
 * @param frameHeight Video frame height
 * @returns Point2D in pixel coordinates
 */
export function landmarkToPoint2D(
  landmark: any, 
  frameWidth: number, 
  frameHeight: number
): Point2D {
  return {
    x: landmark.x * frameWidth,
    y: landmark.y * frameHeight
  };
}

/**
 * Smooth angle data using moving average
 * @param newAngle New angle measurement
 * @param angleHistory Array of previous angles
 * @param windowSize Window size for smoothing
 * @returns Smoothed angle
 */
export function smoothAngle(
  newAngle: number, 
  angleHistory: number[], 
  windowSize: number = 5
): number {
  angleHistory.push(newAngle);
  
  if (angleHistory.length > windowSize) {
    angleHistory.shift();
  }
  
  // Use median filter to remove outliers, then moving average
  const sorted = [...angleHistory].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  
  // If new angle is way off from median, use median instead
  if (Math.abs(newAngle - median) > 30) {
    return median;
  }
  
  // Otherwise use weighted average favoring recent data
  let weightedSum = 0;
  let totalWeight = 0;
  
  angleHistory.forEach((angle, index) => {
    const weight = index + 1; // More recent = higher weight
    weightedSum += angle * weight;
    totalWeight += weight;
  });
  
  return weightedSum / totalWeight;
}