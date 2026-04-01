import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Video } from './video.entity';
import { Challenge } from './challenge.entity';
import { StaticFallbackQuestion } from './static-question.entity';

@Entity('challenge_delivery_events')
export class ChallengeDeliveryEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'video_id', type: 'uuid' })
  videoId: string;

  @CreateDateColumn({ name: 'delivered_at', type: 'timestamptz' })
  deliveredAt: Date;

  @Column({ name: 'delivery_source', type: 'varchar', length: 16 })
  deliverySource: 'pool' | 'vector' | 'static';

  @Column({ name: 'challenge_id', type: 'uuid', nullable: true })
  challengeId: string | null;

  @Column({ name: 'static_question_id', type: 'uuid', nullable: true })
  staticQuestionId: string | null;

  @Column({ name: 'question_snapshot', type: 'text' })
  questionSnapshot: string;

  @Column({ name: 'options_snapshot', type: 'jsonb', nullable: true })
  optionsSnapshot: object | null;

  @Column({ name: 'answer_snapshot', type: 'text', nullable: true })
  answerSnapshot: string | null;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @ManyToOne(() => Challenge, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'challenge_id' })
  challenge: Challenge | null;

  @ManyToOne(() => StaticFallbackQuestion, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'static_question_id' })
  staticQuestion: StaticFallbackQuestion | null;
}
