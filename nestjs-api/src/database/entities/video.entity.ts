import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Challenge } from './challenge.entity';

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'original_name', length: 512 })
  originalName: string;

  @Column({ name: 'mime_type', length: 128, default: 'video/mp4' })
  mimeType: string;

  @Column({ name: 'relative_path', length: 1024 })
  relativePath: string;

  @Column({ type: 'text', nullable: true })
  transcript: string | null;

  @Column({ name: 'scene_description', type: 'text', nullable: true })
  sceneDescription: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Challenge, (challenge) => challenge.video)
  challenges: Challenge[];
}
