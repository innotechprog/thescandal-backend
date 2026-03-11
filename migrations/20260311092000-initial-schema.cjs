'use strict';

/**
 * Initial schema migration for TheScandal backend.
 *
 * Notes:
 * - This migration is idempotent for existing databases by checking table existence.
 * - It creates the same tables currently modeled in Sequelize models/.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = new Set(
      existingTablesRaw.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name))
    );

    if (!existingTables.has('posts')) {
      await queryInterface.createTable('posts', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        username: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        media: {
          type: DataTypes.ARRAY(DataTypes.TEXT),
          allowNull: false,
          defaultValue: [],
        },
        flagged: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        likes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        country: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        placeMentioned: {
          type: DataTypes.STRING(140),
          allowNull: true,
        },
        topicKeywords: {
          type: DataTypes.ARRAY(DataTypes.STRING(60)),
          allowNull: false,
          defaultValue: [],
        },
        timestamp: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('posts', ['timestamp'], { name: 'idx_posts_timestamp' });
      await queryInterface.addIndex('posts', ['likes'], { name: 'idx_posts_likes' });
      await queryInterface.addIndex('posts', ['country'], { name: 'idx_posts_country' });
      await queryInterface.addIndex('posts', ['flagged'], { name: 'idx_posts_flagged' });
    }

    if (!existingTables.has('comments')) {
      await queryInterface.createTable('comments', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        postId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'posts',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        username: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        country: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        placeMentioned: {
          type: DataTypes.STRING(140),
          allowNull: true,
        },
        topicKeywords: {
          type: DataTypes.ARRAY(DataTypes.STRING(60)),
          allowNull: false,
          defaultValue: [],
        },
        media: {
          type: DataTypes.ARRAY(DataTypes.TEXT),
          allowNull: false,
          defaultValue: [],
        },
        timestamp: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('comments', ['postId'], { name: 'idx_comments_post_id' });
      await queryInterface.addIndex('comments', ['timestamp'], { name: 'idx_comments_timestamp' });
      await queryInterface.addIndex('comments', ['country'], { name: 'idx_comments_country' });
    }

    if (!existingTables.has('admins')) {
      await queryInterface.createTable('admins', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        username: {
          type: DataTypes.STRING(50),
          allowNull: false,
          unique: true,
        },
        password: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('admins', ['username'], { name: 'idx_admins_username', unique: true });
    }

    if (!existingTables.has('ads')) {
      await queryInterface.createTable('ads', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        businessName: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING(200),
          allowNull: true,
        },
        adType: {
          type: DataTypes.ENUM('banner', 'sponsoredPost'),
          allowNull: false,
          defaultValue: 'banner',
        },
        tagline: {
          type: DataTypes.STRING(300),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        keywords: {
          type: DataTypes.ARRAY(DataTypes.STRING(60)),
          allowNull: false,
          defaultValue: [],
        },
        status: {
          type: DataTypes.ENUM('pending', 'approved', 'rejected'),
          allowNull: false,
          defaultValue: 'approved',
        },
        reviewNote: {
          type: DataTypes.STRING(400),
          allowNull: true,
        },
        imageUrl: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        linkUrl: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('ads', ['status'], { name: 'idx_ads_status' });
      await queryInterface.addIndex('ads', ['active'], { name: 'idx_ads_active' });
      await queryInterface.addIndex('ads', ['adType'], { name: 'idx_ads_ad_type' });
      await queryInterface.addIndex('ads', ['createdAt'], { name: 'idx_ads_created_at' });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('comments');
    await queryInterface.dropTable('posts');
    await queryInterface.dropTable('admins');
    await queryInterface.dropTable('ads');

    // Cleanup enum types generated by Sequelize in PostgreSQL.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ads_adType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ads_status";');
  },
};
