// src/utils/visualFeedbackUtils.ts - Enhanced visual feedback utilities
export interface DrawingContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Draw text with background for better visibility
 */
export function drawTextWithBackground(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: Point,
  font: string = '16px Arial',
  textColor: Color = { r: 255, g: 255, b: 255 },
  backgroundColor: Color = { r: 0, g: 0, b: 0, a: 0.7 },
  padding: number = 8
): void {
  ctx.font = font;
  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;
  const textHeight = 20; // Approximate height for most fonts

  // Draw background rectangle
  ctx.fillStyle = `rgba(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b}, ${backgroundColor.a || 1})`;
  ctx.fillRect(
    position.x - padding,
    position.y - textHeight - padding,
    textWidth + 2 * padding,
    textHeight + 2 * padding
  );

  // Draw text
  ctx.fillStyle = `rgba(${textColor.r}, ${textColor.g}, ${textColor.b}, ${textColor.a || 1})`;
  ctx.fillText(text, position.x, position.y);
}

/**
 * Draw a gauge meter for angle visualization
 */
export function drawGaugeMeter(
  ctx: CanvasRenderingContext2D,
  angle: number,
  position: Point,
  radius: number = 50,
  color: Color = { r: 0, g: 0, b: 255 },
  title: string = 'Angle'
): void {
  const startAngle = Math.PI; // 180 degrees
  const endAngle = 0; // 0 degrees

  // Draw outer circle
  ctx.strokeStyle = `rgba(200, 200, 200, 1)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(position.x, position.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  // Calculate the angle position on the gauge
  let gaugeAngle = startAngle - (angle * (startAngle - endAngle) / 180);
  gaugeAngle = Math.max(Math.min(gaugeAngle, startAngle), endAngle); // Constrain angle

  // Calculate point on circle
  const gaugeX = position.x + radius * Math.cos(gaugeAngle);
  const gaugeY = position.y - radius * Math.sin(gaugeAngle);

  // Draw line from center to angle point
  ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 1)`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(position.x, position.y);
  ctx.lineTo(gaugeX, gaugeY);
  ctx.stroke();

  // Draw center circle
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 1)`;
  ctx.beginPath();
  ctx.arc(position.x, position.y, 5, 0, 2 * Math.PI);
  ctx.fill();

  // Draw angle text
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 1)`;
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(angle)}°`, position.x, position.y + radius + 25);

  // Draw title
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.font = '12px Arial';
  ctx.fillText(title, position.x, position.y - radius - 15);
  ctx.textAlign = 'left';
}

/**
 * Draw a progress bar for exercise tracking
 */
export function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  value: number,
  maxValue: number,
  position: Point,
  size: Size = { width: 200, height: 20 },
  fillColor: Color = { r: 0, g: 255, b: 0 },
  backgroundColor: Color = { r: 255, g: 255, b: 255 },
  borderColor: Color = { r: 0, g: 0, b: 0 }
): void {
  // Calculate fill width
  const fillWidth = Math.min((value / maxValue) * size.width, size.width);

  // Draw background
  ctx.fillStyle = `rgba(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b}, 1)`;
  ctx.fillRect(position.x, position.y, size.width, size.height);

  // Draw border
  ctx.strokeStyle = `rgba(${borderColor.r}, ${borderColor.g}, ${borderColor.b}, 1)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(position.x, position.y, size.width, size.height);

  // Draw fill
  if (fillWidth > 0) {
    ctx.fillStyle = `rgba(${fillColor.r}, ${fillColor.g}, ${fillColor.b}, 1)`;
    ctx.fillRect(position.x, position.y, fillWidth, size.height);
  }

  // Draw text
  const text = `${value}/${maxValue}`;
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  const textX = position.x + size.width / 2;
  const textY = position.y + size.height / 2 + 4;
  ctx.fillText(text, textX, textY);
  ctx.textAlign = 'left';
}

/**
 * Draw exercise stage indicator
 */
export function drawStageIndicator(
  ctx: CanvasRenderingContext2D,
  stage: string,
  position: Point,
  color: Color = { r: 255, g: 255, b: 255 },
  backgroundColor: Color = { r: 0, g: 0, b: 0, a: 0.7 }
): void {
  const stageText = `Stage: ${stage}`;
  drawTextWithBackground(ctx, stageText, position, '16px Arial', color, backgroundColor);
}

/**
 * Draw rep counter display
 */
export function drawRepCounter(
  ctx: CanvasRenderingContext2D,
  count: number,
  position: Point,
  color: Color = { r: 255, g: 255, b: 255 },
  backgroundColor: Color = { r: 0, g: 0, b: 0, a: 0.7 }
): void {
  const countText = `Count: ${count}`;
  drawTextWithBackground(ctx, countText, position, '18px Arial', color, backgroundColor);
}

/**
 * Draw warning messages
 */
export function drawWarnings(
  ctx: CanvasRenderingContext2D,
  warnings: string[],
  position: Point,
  maxWarnings: number = 3
): void {
  const warningsToShow = warnings.slice(0, maxWarnings);
  
  warningsToShow.forEach((warning, index) => {
    const warningPosition = {
      x: position.x,
      y: position.y + (index * 25)
    };
    
    drawTextWithBackground(
      ctx,
      warning,
      warningPosition,
      '14px Arial',
      { r: 255, g: 255, b: 255 },
      { r: 255, g: 0, b: 0, a: 0.8 }
    );
  });
}

/**
 * Draw form score indicator
 */
export function drawFormScore(
  ctx: CanvasRenderingContext2D,
  score: number,
  position: Point
): void {
  let color: Color;
  let backgroundColor: Color;
  
  if (score >= 80) {
    color = { r: 255, g: 255, b: 255 };
    backgroundColor = { r: 0, g: 200, b: 0, a: 0.8 };
  } else if (score >= 60) {
    color = { r: 0, g: 0, b: 0 };
    backgroundColor = { r: 255, g: 255, b: 0, a: 0.8 };
  } else {
    color = { r: 255, g: 255, b: 255 };
    backgroundColor = { r: 255, g: 0, b: 0, a: 0.8 };
  }
  
  const scoreText = `Form: ${Math.round(score)}%`;
  drawTextWithBackground(ctx, scoreText, position, '16px Arial', color, backgroundColor);
}

/**
 * Draw velocity loss indicator
 */
export function drawVelocityLoss(
  ctx: CanvasRenderingContext2D,
  velocityLoss: number,
  threshold: number,
  position: Point
): void {
  const vlPercent = Math.round(velocityLoss * 100);
  const thresholdPercent = Math.round(threshold * 100);
  
  let color: Color;
  let backgroundColor: Color;
  
  if (vlPercent <= thresholdPercent) {
    color = { r: 255, g: 255, b: 255 };
    backgroundColor = { r: 0, g: 200, b: 0, a: 0.8 };
  } else if (vlPercent <= thresholdPercent + 10) {
    color = { r: 0, g: 0, b: 0 };
    backgroundColor = { r: 255, g: 255, b: 0, a: 0.8 };
  } else {
    color = { r: 255, g: 255, b: 255 };
    backgroundColor = { r: 255, g: 0, b: 0, a: 0.8 };
  }
  
  const vlText = `VL: ${vlPercent}%`;
  drawTextWithBackground(ctx, vlText, position, '16px Arial', color, backgroundColor);
}

/**
 * Draw enhanced pose with colored lines for specific exercises
 */
export function drawEnhancedPose(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  width: number,
  height: number,
  exerciseType: string = 'general'
): void {
  if (!landmarks || landmarks.length === 0) return;

  // Define exercise-specific joint connections
  const exerciseConnections: { [key: string]: number[][] } = {
    squats: [
      [11, 23], [12, 24], // Shoulder to hip
      [23, 25], [24, 26], // Hip to knee
      [25, 27], [26, 28], // Knee to ankle
    ],
    push_ups: [
      [11, 13], [12, 14], // Shoulder to elbow
      [13, 15], [14, 16], // Elbow to wrist
    ],
    bicep_curl: [
      [11, 13], [12, 14], // Shoulder to elbow
      [13, 15], [14, 16], // Elbow to wrist
      [11, 23], [12, 24], // Shoulder to hip (for posture check)
    ],
    general: [
      [11, 12], [11, 23], [12, 24], [23, 24], // Torso
      [11, 13], [13, 15], [12, 14], [14, 16], // Arms
      [23, 25], [25, 27], [24, 26], [26, 28], // Legs
    ]
  };

  const connections = exerciseConnections[exerciseType] || exerciseConnections.general;

  // Draw skeleton connections
  ctx.strokeStyle = 'rgba(80, 215, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();

  connections.forEach(([startIdx, endIdx]) => {
    const startPoint = landmarks[startIdx];
    const endPoint = landmarks[endIdx];
    
    if (startPoint && endPoint && 
        (startPoint.visibility || 1) > 0.5 && 
        (endPoint.visibility || 1) > 0.5) {
      ctx.moveTo(startPoint.x * width, startPoint.y * height);
      ctx.lineTo(endPoint.x * width, endPoint.y * height);
    }
  });
  ctx.stroke();

  // Draw joints
  ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
  landmarks.forEach((landmark, index) => {
    if ((landmark.visibility || 1) > 0.5) {
      ctx.beginPath();
      ctx.arc(landmark.x * width, landmark.y * height, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  });

  // Highlight specific joints for the exercise
  highlightExerciseJoints(ctx, landmarks, width, height, exerciseType);
}

/**
 * Highlight specific joints based on exercise type
 */
function highlightExerciseJoints(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  width: number,
  height: number,
  exerciseType: string
): void {
  const exerciseJoints: { [key: string]: number[] } = {
    squats: [11, 12, 23, 24, 25, 26], // Shoulders, hips, knees
    push_ups: [11, 12, 13, 14, 15, 16], // Shoulders, elbows, wrists
    bicep_curl: [11, 12, 13, 14, 15, 16], // Shoulders, elbows, wrists
  };

  const jointsToHighlight = exerciseJoints[exerciseType] || [];

  ctx.fillStyle = 'rgba(245, 158, 11, 1)';
  jointsToHighlight.forEach(jointIndex => {
    const landmark = landmarks[jointIndex];
    if (landmark && (landmark.visibility || 1) > 0.5) {
      ctx.beginPath();
      ctx.arc(landmark.x * width, landmark.y * height, 6, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}

/**
 * Draw a comprehensive exercise overlay with all indicators
 */
export function drawExerciseOverlay(
  ctx: CanvasRenderingContext2D,
  exerciseData: {
    name: string;
    reps: number;
    targetReps: number;
    currentSet: number;
    totalSets: number;
    angle: number;
    stage: string;
    formScore: number;
    velocityLoss: number;
    warnings: string[];
  },
  canvasWidth: number,
  canvasHeight: number
): void {
  // Exercise info (top left)
  drawTextWithBackground(
    ctx,
    `Exercise: ${exerciseData.name}`,
    { x: 20, y: 40 },
    '18px Arial',
    { r: 255, g: 255, b: 255 },
    { r: 0, g: 0, b: 0, a: 0.8 }
  );

  drawTextWithBackground(
    ctx,
    `Set ${exerciseData.currentSet}/${exerciseData.totalSets}`,
    { x: 20, y: 70 },
    '16px Arial',
    { r: 255, g: 255, b: 255 },
    { r: 0, g: 0, b: 0, a: 0.8 }
  );

  // Rep counter (top right)
  drawRepCounter(ctx, exerciseData.reps, { x: canvasWidth - 150, y: 40 });

  // Progress bar (below rep counter)
  drawProgressBar(
    ctx,
    exerciseData.reps,
    exerciseData.targetReps,
    { x: canvasWidth - 220, y: 60 },
    { width: 200, height: 20 }
  );

  // Stage indicator (below progress bar)
  drawStageIndicator(ctx, exerciseData.stage, { x: canvasWidth - 150, y: 100 });

  // Form score (bottom left)
  drawFormScore(ctx, exerciseData.formScore, { x: 20, y: canvasHeight - 60 });

  // Velocity loss (next to form score)
  drawVelocityLoss(ctx, exerciseData.velocityLoss, 0.25, { x: 20, y: canvasHeight - 30 });

  // Angle gauge (bottom center)
  drawGaugeMeter(
    ctx,
    exerciseData.angle,
    { x: canvasWidth / 2, y: canvasHeight - 80 },
    50,
    { r: 0, g: 0, b: 255 },
    'Angle'
  );

  // Warnings (right side)
  if (exerciseData.warnings.length > 0) {
    drawWarnings(ctx, exerciseData.warnings, { x: canvasWidth - 300, y: canvasHeight / 2 });
  }
}